import { io, Socket } from "socket.io-client";
import { PeerConnectionManager } from "./PeerConnectionManager";
import type { CallSession, SignalPeer } from "../renderer/types";

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
  private destroyed = false;

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

    // Get local audio
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      this.callbacks.onLocalStream(this.localStream);
    } catch (err) {
      console.error("Failed to get local media:", err);
      this.callbacks.onStatusChange("Microphone access denied");
      return;
    }

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
        for (const pcm of this.peers.values()) {
          pcm.close();
        }
        this.peers.clear();
        this.remoteStreams.clear();
        this.remoteScreenStreams.clear();
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
  }

  private setupSocketListeners(): void {
    if (!this.socket) return;

    this.socket.on("signal:joined", (data: {
      peers: SignalPeer[];
      activeScreenSharerUserId: string | null;
    }) => {
      if (this.destroyed) return;
      this._joined = true;
      this.callbacks.onStatusChange("Connected");
      this.callbacks.onJoined(data.peers);
      this.startHeartbeat();

      // Create peer connections for existing peers (we are the offerer)
      for (const peer of data.peers) {
        if (peer.userId !== this.session.userId) {
          this.ensurePeerConnection(peer.userId);
        }
      }

      if (data.activeScreenSharerUserId) {
        this._activeScreenSharerUserId = data.activeScreenSharerUserId;
        this.callbacks.onScreenShareStarted(data.activeScreenSharerUserId);
      }
    });

    this.socket.on("signal:peer-joined", (data: SignalPeer) => {
      if (this.destroyed) return;
      this.callbacks.onPeerJoined(data);
      // New peer arrived — they will send us offers, we don't need to initiate
    });

    this.socket.on("signal:peer-left", (data: { userId: string; activeScreenSharerUserId: string | null }) => {
      if (this.destroyed) return;
      this.removePeer(data.userId);
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
        this.socket!.emit("signal:answer", {
          workspaceId: this.session.workspaceId,
          roomId: this.session.roomId,
          toUserId: data.fromUserId,
          payload: answer,
        });
      } catch (err) {
        console.error(`Failed to handle offer from ${data.fromUserId}:`, err);
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
          console.error(`Failed to handle answer from ${data.fromUserId}:`, err);
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
          console.error(`Failed to add ICE candidate from ${data.fromUserId}:`, err);
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

    this.socket.on("signal:error", (data: { code: string; message: string }) => {
      console.error(`Signal error: ${data.code} - ${data.message}`);
    });
  }

  private ensurePeerConnection(peerId: string): PeerConnectionManager {
    let pcm = this.peers.get(peerId);
    if (pcm) return pcm;

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

        // If this peer is the active screen sharer and we already have
        // a different stream for them, the new stream is their screen share
        const existingStream = this.remoteStreams.get(peerId);
        const isScreenShare =
          this._activeScreenSharerUserId === peerId &&
          existingStream &&
          existingStream.id !== stream.id;

        if (isScreenShare) {
          this.remoteScreenStreams.set(peerId, stream);
          this.callbacks.onRemoteScreenStream(peerId, stream);
        } else if (!existingStream) {
          this.remoteStreams.set(peerId, stream);
          this.callbacks.onRemoteStream(peerId, stream);
        } else {
          // Same stream, track added (e.g. camera track added to existing audio stream)
          this.remoteStreams.set(peerId, stream);
          this.callbacks.onRemoteStream(peerId, stream);
        }
      },
      onConnectionStateChange: (state) => {
        console.log(`[Peer:${peerId}] connection state: ${state}`);
        if (state === "failed" || state === "closed") {
          this.remoteStreams.delete(peerId);
          this.callbacks.onRemoteStreamRemoved(peerId);
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
    });

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
    this.callbacks.onRemoteStreamRemoved(userId);
    if (this.remoteScreenStreams.has(userId)) {
      this.remoteScreenStreams.delete(userId);
      this.callbacks.onRemoteScreenStreamRemoved(userId);
    }
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
      // Turn off camera
      if (this.localStream) {
        for (const track of this.localStream.getVideoTracks()) {
          track.stop();
          this.localStream.removeTrack(track);
        }
      }
      this._cameraEnabled = false;
    } else {
      // Turn on camera
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = videoStream.getVideoTracks()[0];
        if (this.localStream && videoTrack) {
          this.localStream.addTrack(videoTrack);
          // Add to all peer connections
          for (const pcm of this.peers.values()) {
            pcm.addTrack(videoTrack, this.localStream);
          }
        }
        this._cameraEnabled = true;
      } catch (err) {
        console.error("Failed to enable camera:", err);
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
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = this.screenStream.getVideoTracks()[0];

      // Handle user clicking "Stop sharing" in system dialog
      videoTrack.onended = () => {
        this.stopScreenShare();
      };

      // Add screen track to all peer connections
      this.screenSenders = [];
      for (const pcm of this.peers.values()) {
        const sender = pcm.addTrack(videoTrack, this.screenStream);
        this.screenSenders.push(sender);
      }

      this.socket?.emit("signal:screen-share-start");
      this._screenSharing = true;
      return true;
    } catch (err) {
      console.error("Failed to start screen share:", err);
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

    // Remove senders from peer connections
    for (const sender of this.screenSenders) {
      try {
        for (const pcm of this.peers.values()) {
          pcm.removeTrack(sender);
        }
      } catch {
        // Sender may already be removed
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

    for (const pcm of this.peers.values()) {
      pcm.close();
    }
    this.peers.clear();
    this.remoteStreams.clear();

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

  get micEnabled(): boolean { return this._micEnabled; }
  get cameraEnabled(): boolean { return this._cameraEnabled; }
  get screenSharing(): boolean { return this._screenSharing; }
  get joined(): boolean { return this._joined; }
}
