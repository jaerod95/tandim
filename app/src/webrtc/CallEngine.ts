import { io, Socket } from "socket.io-client";
import { PeerConnectionManager } from "./PeerConnectionManager";
import type { CallSession, SignalPeer } from "../renderer/types";

type PeerAudioNodes = {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
};

export type CrosstalkInfo = {
  id: string;
  initiatorUserId: string;
  participantUserIds: string[];
};

export type CallEngineCallbacks = {
  onStatusChange: (status: string) => void;
  onPeerJoined: (peer: SignalPeer) => void;
  onPeerLeft: (userId: string) => void;
  onRemoteStream: (userId: string, stream: MediaStream) => void;
  onRemoteStreamRemoved: (userId: string) => void;
  onRemoteScreenStream: (userId: string, stream: MediaStream) => void;
  onRemoteScreenStreamRemoved: (userId: string) => void;
  onScreenShareStarted: (userId: string) => void;
  onScreenShareStopped: () => void;
  onJoined: (peers: SignalPeer[]) => void;
  onDisconnected: () => void;
  onLocalStream: (stream: MediaStream) => void;
  onSinkIdChange?: (sinkId: string) => void;
  onCrosstalksChanged: (crosstalks: CrosstalkInfo[]) => void;
};

export class CallEngine {
  private socket: Socket | null = null;
  private peers = new Map<string, PeerConnectionManager>();
  private remoteStreams = new Map<string, MediaStream>();
  private remoteScreenStreams = new Map<string, MediaStream>();
  private localStream: MediaStream | null = null;
  private screenStream: MediaStream | null = null;
  private screenSenders: RTCRtpSender[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private iceConfig: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  private _micEnabled = true;
  private _cameraEnabled = false;
  private _screenSharing = false;
  private _joined = false;
  private _activeScreenSharerUserId: string | null = null;
  private _sinkId = "";
  private _activeCrosstalks = new Map<string, CrosstalkInfo>();
  private destroyed = false;

  /** Set of peerIds that were already in the room when we joined */
  private existingPeerIds = new Set<string>();

  // Audio routing for crosstalk
  private audioContext: AudioContext | null = null;
  private peerAudioNodes = new Map<string, PeerAudioNodes>();
  private _outsideVolume = 0.15;

  constructor(
    private session: CallSession,
    private callbacks: CallEngineCallbacks,
  ) {}

  async join(): Promise<void> {
    this.callbacks.onStatusChange("Connecting...");

    // Fetch ICE config
    try {
      const res = await fetch(`${this.session.apiUrl}/api/ice-config`);
      const config = await res.json();
      if (config.iceServers) {
        this.iceConfig = { iceServers: config.iceServers };
      }
    } catch {
      // Use default STUN
    }

    // Get local audio (continue in listen-only mode if denied)
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.callbacks.onLocalStream(this.localStream);
    } catch (err) {
      console.error("Failed to get local media:", err);
      this.callbacks.onStatusChange("Microphone access denied — joining in listen-only mode");
      this._micEnabled = false;
    }

    // Create AudioContext for routing remote audio through gain nodes
    this.audioContext = new AudioContext();

    // Connect socket
    this.socket = io(this.session.apiUrl, {
      path: "/api/signal",
      transports: ["websocket"],
    });

    this.setupSocketListeners();

    this.socket.on("connect", () => {
      if (this.destroyed) return;

      // On reconnect, close stale peer connections before re-joining
      if (this.peers.size > 0) {
        console.log("[WebRTC] Socket reconnected, clearing stale peers");
        for (const pcm of this.peers.values()) {
          pcm.close();
        }
        this.peers.clear();
        this.remoteStreams.clear();
        this.remoteScreenStreams.clear();
        this.existingPeerIds.clear();
        for (const userId of [...this.peerAudioNodes.keys()]) {
          this.teardownPeerAudio(userId);
        }
      }

      this.callbacks.onStatusChange("Connecting...");
      this.socket!.emit("signal:join", {
        workspaceId: this.session.workspaceId,
        roomId: this.session.roomId,
        userId: this.session.userId,
        displayName: this.session.displayName,
      });
    });

    this.socket.on("disconnect", () => {
      if (this.destroyed) return;
      this._joined = false;
      this.stopHeartbeat();
      this.callbacks.onStatusChange("Reconnecting...");
      this.callbacks.onDisconnected();
    });

    this.socket.on("connect_error", () => {
      if (this.destroyed) return;
      this.callbacks.onStatusChange("Server unreachable — retrying...");
    });
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on("signal:joined", (data: {
      peers: SignalPeer[];
      activeScreenSharerUserId: string | null;
      crosstalks?: CrosstalkInfo[];
    }) => {
      if (this.destroyed) return;
      this._joined = true;
      this.callbacks.onStatusChange("Connected");
      this.callbacks.onJoined(data.peers);
      this.startHeartbeat();

      // Track which peers were already in the room — we are impolite to them
      // (we will be the offerer; they wait for our offer).
      this.existingPeerIds.clear();
      for (const peer of data.peers) {
        if (peer.userId !== this.session.userId) {
          this.existingPeerIds.add(peer.userId);
        }
      }

      // Create peer connections for existing peers (we are the offerer → impolite)
      for (const peer of data.peers) {
        if (peer.userId !== this.session.userId) {
          this.ensurePeerConnection(peer.userId);
        }
      }

      if (data.activeScreenSharerUserId) {
        this._activeScreenSharerUserId = data.activeScreenSharerUserId;
        this.callbacks.onScreenShareStarted(data.activeScreenSharerUserId);
      }

      // Load existing crosstalks
      this._activeCrosstalks.clear();
      if (data.crosstalks) {
        for (const ct of data.crosstalks) {
          this._activeCrosstalks.set(ct.id, ct);
        }
      }
      this.callbacks.onCrosstalksChanged(Array.from(this._activeCrosstalks.values()));
    });

    this.socket.on("signal:peer-joined", (data: SignalPeer) => {
      if (this.destroyed) return;
      this.callbacks.onPeerJoined(data);
      // New peer arrived after us — they will send offers, we are polite.
      // Don't add to existingPeerIds; ensurePeerConnection will see they're
      // NOT in existingPeerIds and mark us as polite for this peer.
    });

    this.socket.on("signal:peer-left", (data: { userId: string; activeScreenSharerUserId: string | null }) => {
      if (this.destroyed) return;
      this.removePeer(data.userId);
      this.existingPeerIds.delete(data.userId);
      this.callbacks.onPeerLeft(data.userId);
      if (!data.activeScreenSharerUserId && this._activeScreenSharerUserId) {
        this._activeScreenSharerUserId = null;
        this.callbacks.onScreenShareStopped();
      }
    });

    this.socket.on("signal:offer", async (data: {
      fromUserId: string;
      payload: RTCSessionDescriptionInit;
    }) => {
      if (this.destroyed) return;
      const pcm = this.ensurePeerConnection(data.fromUserId);
      try {
        const answer = await pcm.handleOffer(data.payload);
        if (answer) {
          this.socket!.emit("signal:answer", {
            workspaceId: this.session.workspaceId,
            roomId: this.session.roomId,
            toUserId: data.fromUserId,
            payload: answer,
          });
        }
        // answer === null means offer was ignored (impolite glare resolution)
      } catch (err) {
        console.error(`[WebRTC] Failed to handle offer from ${data.fromUserId}:`, err);
      }
    });

    this.socket.on("signal:answer", async (data: {
      fromUserId: string;
      payload: RTCSessionDescriptionInit;
    }) => {
      if (this.destroyed) return;
      const pcm = this.peers.get(data.fromUserId);
      if (pcm) {
        try {
          await pcm.handleAnswer(data.payload);
        } catch (err) {
          console.error(`[WebRTC] Failed to handle answer from ${data.fromUserId}:`, err);
        }
      }
    });

    this.socket.on("signal:ice-candidate", async (data: {
      fromUserId: string;
      payload: RTCIceCandidateInit;
    }) => {
      if (this.destroyed) return;
      const pcm = this.peers.get(data.fromUserId);
      if (pcm) {
        try {
          await pcm.handleIceCandidate(data.payload);
        } catch (err) {
          console.error(`[WebRTC] Failed to add ICE candidate from ${data.fromUserId}:`, err);
        }
      }
    });

    this.socket.on("signal:screen-share-started", (data: { userId: string }) => {
      if (this.destroyed) return;
      this._activeScreenSharerUserId = data.userId;
      this.callbacks.onScreenShareStarted(data.userId);
    });

    this.socket.on("signal:screen-share-stopped", () => {
      if (this.destroyed) return;
      const prevSharer = this._activeScreenSharerUserId;
      this._activeScreenSharerUserId = null;
      if (prevSharer) {
        this.remoteScreenStreams.delete(prevSharer);
        this.callbacks.onRemoteScreenStreamRemoved(prevSharer);
      }
      this.callbacks.onScreenShareStopped();
    });

    this.socket.on("signal:crosstalk-started", (data: { crosstalk: CrosstalkInfo }) => {
      if (this.destroyed) return;
      this._activeCrosstalks.set(data.crosstalk.id, data.crosstalk);
      this.applyGainLevels();
      this.callbacks.onCrosstalksChanged(Array.from(this._activeCrosstalks.values()));
    });

    this.socket.on("signal:crosstalk-ended", (data: { crosstalkId: string }) => {
      if (this.destroyed) return;
      this._activeCrosstalks.delete(data.crosstalkId);
      this.applyGainLevels();
      this.callbacks.onCrosstalksChanged(Array.from(this._activeCrosstalks.values()));
    });

    this.socket.on("signal:error", (data: { code: string; message: string }) => {
      console.error(`[WebRTC] Signal error: ${data.code} - ${data.message}`);
    });
  }

  private ensurePeerConnection(peerId: string): PeerConnectionManager {
    let pcm = this.peers.get(peerId);
    if (pcm) return pcm;

    // Determine politeness:
    // - Peers that were already in the room when we joined are in existingPeerIds.
    //   We are the offerer for those, so we are IMPOLITE (polite = false).
    // - Peers that joined after us are NOT in existingPeerIds.
    //   They will send us offers, so we are POLITE (polite = true).
    const polite = !this.existingPeerIds.has(peerId);
    console.log(
      `[WebRTC] Creating peer connection for ${peerId} (we are ${polite ? "polite" : "impolite"})`,
    );

    pcm = new PeerConnectionManager(peerId, this.iceConfig, {
      onIceCandidate: (candidate) => {
        this.socket?.emit("signal:ice-candidate", {
          workspaceId: this.session.workspaceId,
          roomId: this.session.roomId,
          toUserId: peerId,
          payload: candidate,
        });
      },
      onTrack: (event) => {
        const stream = event.streams[0];
        if (!stream) return;

        // A second, different stream from a peer is a screen share.
        // We detect this without relying on _activeScreenSharerUserId
        // because the WebRTC track often arrives before the socket event.
        const existingStream = this.remoteStreams.get(peerId);
        const isSecondStream = existingStream && existingStream.id !== stream.id;

        if (isSecondStream) {
          this.remoteScreenStreams.set(peerId, stream);
          this.callbacks.onRemoteScreenStream(peerId, stream);
        } else if (!existingStream) {
          this.remoteStreams.set(peerId, stream);
          this.routeRemoteAudio(peerId, stream);
          this.callbacks.onRemoteStream(peerId, stream);
        } else {
          // Same stream, track added (e.g. camera track added to existing audio stream)
          this.remoteStreams.set(peerId, stream);
          this.routeRemoteAudio(peerId, stream);
          this.callbacks.onRemoteStream(peerId, stream);
        }
      },
      onConnectionStateChange: (state) => {
        console.log(`[WebRTC] Peer ${peerId} connection state: ${state}`);
        if (state === "connected") {
          // Connection recovered — reset ICE restart counter
          const peerPcm = this.peers.get(peerId);
          peerPcm?.resetIceRestartCount();
        }
        if (state === "failed" || state === "closed") {
          // ICE restart is handled inside PeerConnectionManager (attemptIceRestart).
          // Only remove the stream on "closed" (permanent).
          if (state === "closed") {
            this.remoteStreams.delete(peerId);
            this.teardownPeerAudio(peerId);
            this.callbacks.onRemoteStreamRemoved(peerId);
          }
        }
      },
      onNegotiationNeeded: (offer) => {
        this.socket?.emit("signal:offer", {
          workspaceId: this.session.workspaceId,
          roomId: this.session.roomId,
          toUserId: peerId,
          payload: offer,
        });
      },
      onIceRestart: (offer) => {
        console.log(`[WebRTC] Sending ICE restart offer to ${peerId}`);
        this.socket?.emit("signal:offer", {
          workspaceId: this.session.workspaceId,
          roomId: this.session.roomId,
          toUserId: peerId,
          payload: offer,
        });
      },
    }, polite);

    // Add local tracks to the connection
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pcm.addTrack(track, this.localStream);
      }
    }

    // Add screen share tracks if sharing
    if (this.screenStream) {
      for (const track of this.screenStream.getTracks()) {
        pcm.addTrack(track, this.screenStream);
      }
    }

    this.peers.set(peerId, pcm);
    return pcm;
  }

  private removePeer(userId: string): void {
    const pcm = this.peers.get(userId);
    if (pcm) {
      pcm.close();
      this.peers.delete(userId);
    }
    this.remoteStreams.delete(userId);
    this.teardownPeerAudio(userId);
    this.callbacks.onRemoteStreamRemoved(userId);
    if (this.remoteScreenStreams.has(userId)) {
      this.remoteScreenStreams.delete(userId);
      this.callbacks.onRemoteScreenStreamRemoved(userId);
    }
  }

  // ── Audio routing ──────────────────────────────────────────────

  /**
   * Route a remote peer's audio stream through the Web Audio API
   * so we can control per-peer volume via GainNodes.
   */
  private routeRemoteAudio(userId: string, stream: MediaStream): void {
    if (!this.audioContext) return;

    // Tear down any existing nodes for this peer
    this.teardownPeerAudio(userId);

    const source = this.audioContext.createMediaStreamSource(stream);
    const gain = this.audioContext.createGain();
    gain.gain.value = this.getGainForPeer(userId);
    source.connect(gain);
    gain.connect(this.audioContext.destination);

    this.peerAudioNodes.set(userId, { source, gain });
  }

  private teardownPeerAudio(userId: string): void {
    const nodes = this.peerAudioNodes.get(userId);
    if (!nodes) return;
    try {
      nodes.source.disconnect();
      nodes.gain.disconnect();
    } catch {
      // Already disconnected
    }
    this.peerAudioNodes.delete(userId);
  }

  private getGainForPeer(userId: string): number {
    // Find the crosstalk the local user is in (if any)
    const myCrosstalk = Array.from(this._activeCrosstalks.values()).find(
      (ct) => ct.participantUserIds.includes(this.session.userId)
    );
    if (!myCrosstalk) return 1.0;

    const localInCrosstalk = true;
    const peerInCrosstalk = myCrosstalk.participantUserIds.includes(userId);

    if (!localInCrosstalk) return 1.0;
    return peerInCrosstalk ? 1.0 : this._outsideVolume;
  }

  private applyGainLevels(): void {
    for (const [userId, nodes] of this.peerAudioNodes) {
      nodes.gain.gain.value = this.getGainForPeer(userId);
    }
  }

  private teardownAllAudio(): void {
    for (const userId of [...this.peerAudioNodes.keys()]) {
      this.teardownPeerAudio(userId);
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
  }

  toggleMic(): boolean {
    if (!this.localStream) return this._micEnabled;
    this._micEnabled = !this._micEnabled;
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = this._micEnabled;
    }
    return this._micEnabled;
  }

  async toggleCamera(): Promise<boolean> {
    if (this._cameraEnabled) {
      // Turn off camera — remove video tracks from local stream and peer connections
      if (this.localStream) {
        for (const track of this.localStream.getVideoTracks()) {
          track.stop();
          this.localStream.removeTrack(track);
        }
      }
      // onnegotiationneeded fires automatically on each peer connection when
      // senders are affected by removeTrack on the underlying stream.
      // The makingOffer guard + perfect negotiation ensures no races.
      this._cameraEnabled = false;
    } else {
      // Turn on camera
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (this.localStream && videoTrack) {
          this.localStream.addTrack(videoTrack);
          // Add to all peer connections — this triggers onnegotiationneeded
          // on each PCM which will create and send a new offer.
          for (const pcm of this.peers.values()) {
            pcm.addTrack(videoTrack, this.localStream);
          }
        }
        this._cameraEnabled = true;
      } catch (err) {
        console.error("[WebRTC] Failed to enable camera:", err);
      }
    }
    if (this.localStream) {
      this.callbacks.onLocalStream(this.localStream);
    }
    return this._cameraEnabled;
  }

  async toggleScreenShare(): Promise<boolean> {
    if (this._screenSharing) {
      // Stop screen share
      this.stopScreenShare();
      return false;
    }

    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 60 },
        } as MediaTrackConstraints,
        audio: false,
      });
      const videoTrack = this.screenStream.getVideoTracks()[0];

      // Handle user clicking "Stop sharing" in system dialog
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      // Add screen track to all peer connections — triggers onnegotiationneeded
      this.screenSenders = [];
      for (const pcm of this.peers.values()) {
        const sender = pcm.addTrack(videoTrack, this.screenStream);
        this.screenSenders.push(sender);
      }

      this.socket?.emit("signal:screen-share-start");
      this._screenSharing = true;
      return true;
    } catch (err) {
      console.error("[WebRTC] Failed to start screen share:", err);
      return false;
    }
  }

  private stopScreenShare(): void {
    if (this.screenStream) {
      for (const track of this.screenStream.getTracks()) {
        track.stop();
      }
      this.screenStream = null;
    }

    // Remove senders from peer connections — triggers onnegotiationneeded
    for (const sender of this.screenSenders) {
      for (const pcm of this.peers.values()) {
        try {
          pcm.removeTrack(sender);
        } catch {
          // Sender doesn't belong to this PCM
        }
      }
    }
    this.screenSenders = [];

    if (this._screenSharing) {
      this.socket?.emit("signal:screen-share-stop");
      this._screenSharing = false;
      this._activeScreenSharerUserId = null;
      this.callbacks.onScreenShareStopped();
    }
  }

  async switchAudioDevice(deviceId: string): Promise<void> {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });
      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) return;

      if (this.localStream) {
        // Replace in the local stream
        const oldTracks = this.localStream.getAudioTracks();
        for (const old of oldTracks) {
          this.localStream.removeTrack(old);
          old.stop();
        }
        this.localStream.addTrack(newTrack);

        // Preserve mute state
        newTrack.enabled = this._micEnabled;

        // Replace track in all peer connections (no renegotiation needed)
        for (const pcm of this.peers.values()) {
          const sender = pcm
            .getSenders()
            .find((s) => s.track?.kind === "audio");
          if (sender) {
            await pcm.replaceTrack(sender, newTrack);
          }
        }

        this.callbacks.onLocalStream(this.localStream);
      }
    } catch (err) {
      console.error("Failed to switch audio device:", err);
    }
  }

  async switchVideoDevice(deviceId: string): Promise<void> {
    if (!this._cameraEnabled || !this.localStream) return;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;

      // Replace in the local stream
      const oldTracks = this.localStream.getVideoTracks();
      for (const old of oldTracks) {
        this.localStream.removeTrack(old);
        old.stop();
      }
      this.localStream.addTrack(newTrack);

      // Replace track in all peer connections (no renegotiation needed)
      for (const pcm of this.peers.values()) {
        const sender = pcm
          .getSenders()
          .find((s) => s.track?.kind === "video");
        if (sender) {
          await pcm.replaceTrack(sender, newTrack);
        }
      }

      this.callbacks.onLocalStream(this.localStream);
    } catch (err) {
      console.error("Failed to switch video device:", err);
    }
  }

  setSinkId(deviceId: string): void {
    this._sinkId = deviceId;
    this.callbacks.onSinkIdChange?.(deviceId);
  }

  // ── Crosstalk controls ──────────────────────────────────────

  setCrosstalkVolume(volume: number): void {
    this._outsideVolume = Math.max(0, Math.min(1, volume));
    this.applyGainLevels();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.socket?.emit("signal:heartbeat");
    }, 30_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  leave(): void {
    this.destroyed = true;
    this.stopHeartbeat();
    this.stopScreenShare();
    this.teardownAllAudio();
    this._activeCrosstalks.clear();

    for (const pcm of this.peers.values()) {
      pcm.close();
    }
    this.peers.clear();
    this.remoteStreams.clear();
    this.existingPeerIds.clear();

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    this.socket?.disconnect();
    this.socket = null;
  }

  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  startCrosstalk(targetUserIds: string[]): void {
    this.socket?.emit("signal:crosstalk-start", { targetUserIds });
  }

  endCrosstalk(crosstalkId: string): void {
    this.socket?.emit("signal:crosstalk-end", { crosstalkId });
  }

  get micEnabled(): boolean { return this._micEnabled; }
  get cameraEnabled(): boolean { return this._cameraEnabled; }
  get screenSharing(): boolean { return this._screenSharing; }
  get joined(): boolean { return this._joined; }
  get sinkId(): string { return this._sinkId; }
  get activeCrosstalks(): CrosstalkInfo[] { return Array.from(this._activeCrosstalks.values()); }
  get outsideVolume(): number { return this._outsideVolume; }
}
