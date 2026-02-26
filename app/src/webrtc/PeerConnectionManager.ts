export type PeerConnectionCallbacks = {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onTrack: (event: RTCTrackEvent) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onNegotiationNeeded: (offer: RTCSessionDescriptionInit) => void;
  onIceRestart: (offer: RTCSessionDescriptionInit) => void;
};

const MAX_ICE_RESTARTS = 2;
const ICE_DISCONNECTED_TIMEOUT_MS = 5_000;

export class PeerConnectionManager {
  private pc: RTCPeerConnection;
  private iceCandidateBuffer: RTCIceCandidateInit[] = [];
  private makingOffer = false;
  private iceRestartCount = 0;
  private iceDisconnectedTimer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  constructor(
    public readonly peerId: string,
    iceConfig: RTCConfiguration,
    private callbacks: PeerConnectionCallbacks,
    private polite: boolean,
  ) {
    this.pc = new RTCPeerConnection(iceConfig);

    this.pc.onicecandidate = (event) => {
      if (this.closed) return;
      if (event.candidate) {
        this.callbacks.onIceCandidate(event.candidate.toJSON());
      }
    };

    this.pc.ontrack = (event) => {
      if (this.closed) return;
      this.callbacks.onTrack(event);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.closed) return;
      const state = this.pc.connectionState;
      console.log(`[Peer:${this.peerId}] connectionState -> ${state}`);
      this.callbacks.onConnectionStateChange(state);

      if (state === "failed") {
        this.attemptIceRestart();
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      if (this.closed) return;
      const state = this.pc.iceConnectionState;
      console.log(`[Peer:${this.peerId}] iceConnectionState -> ${state}`);

      if (state === "disconnected") {
        this.startIceDisconnectedTimer();
      } else {
        this.clearIceDisconnectedTimer();
      }

      if (state === "failed") {
        this.attemptIceRestart();
      }
    };

    this.pc.onicegatheringstatechange = () => {
      if (this.closed) return;
      console.log(
        `[Peer:${this.peerId}] iceGatheringState -> ${this.pc.iceGatheringState}`,
      );
    };

    this.pc.onnegotiationneeded = async () => {
      if (this.closed) return;
      if (this.makingOffer) return;
      try {
        this.makingOffer = true;
        const offer = await this.pc.createOffer();
        // Another negotiation may have happened while we were creating the offer
        if (this.pc.signalingState !== "stable") return;
        await this.pc.setLocalDescription(offer);
        if (this.pc.localDescription) {
          this.callbacks.onNegotiationNeeded(this.pc.localDescription);
        }
      } catch (err) {
        console.error(
          `[Peer:${this.peerId}] negotiation error:`,
          err,
        );
      } finally {
        this.makingOffer = false;
      }
    };
  }

  // ---- ICE restart logic ----

  private startIceDisconnectedTimer(): void {
    this.clearIceDisconnectedTimer();
    this.iceDisconnectedTimer = setTimeout(() => {
      if (this.closed) return;
      const iceState = this.pc.iceConnectionState;
      if (iceState === "disconnected" || iceState === "failed") {
        console.log(
          `[Peer:${this.peerId}] ICE disconnected for ${ICE_DISCONNECTED_TIMEOUT_MS}ms, attempting restart`,
        );
        this.attemptIceRestart();
      }
    }, ICE_DISCONNECTED_TIMEOUT_MS);
  }

  private clearIceDisconnectedTimer(): void {
    if (this.iceDisconnectedTimer !== undefined) {
      clearTimeout(this.iceDisconnectedTimer);
      this.iceDisconnectedTimer = undefined;
    }
  }

  private attemptIceRestart(): void {
    if (this.closed) return;
    if (this.iceRestartCount >= MAX_ICE_RESTARTS) {
      console.warn(
        `[Peer:${this.peerId}] ICE restart limit reached (${MAX_ICE_RESTARTS}), giving up`,
      );
      return;
    }
    this.iceRestartCount++;
    console.log(
      `[Peer:${this.peerId}] ICE restart attempt ${this.iceRestartCount}/${MAX_ICE_RESTARTS}`,
    );
    this.iceRestart();
  }

  async iceRestart(): Promise<void> {
    if (this.closed) return;
    try {
      this.makingOffer = true;
      const offer = await this.pc.createOffer({ iceRestart: true });
      if (this.pc.signalingState !== "stable") {
        // Roll back first if we're not stable (e.g. have-local-offer)
        await this.pc.setLocalDescription({ type: "rollback" });
      }
      await this.pc.setLocalDescription(offer);
      if (this.pc.localDescription) {
        this.callbacks.onIceRestart(this.pc.localDescription);
      }
    } catch (err) {
      console.error(`[Peer:${this.peerId}] ICE restart failed:`, err);
    } finally {
      this.makingOffer = false;
    }
  }

  /** Reset ICE restart counter (call when connection recovers) */
  resetIceRestartCount(): void {
    this.iceRestartCount = 0;
  }

  // ---- Track management ----

  addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender {
    return this.pc.addTrack(track, stream);
  }

  removeTrack(sender: RTCRtpSender): void {
    this.pc.removeTrack(sender);
  }

  async replaceTrack(
    sender: RTCRtpSender,
    newTrack: MediaStreamTrack,
  ): Promise<void> {
    await sender.replaceTrack(newTrack);
  }

  // ---- Offer / answer / ICE ----

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    this.makingOffer = true;
    try {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      return this.pc.localDescription!;
    } finally {
      this.makingOffer = false;
    }
  }

  /**
   * Handle a remote offer using the perfect negotiation pattern.
   *
   * If this peer is polite and we are currently making an offer (glare),
   * we roll back our local description and accept the remote offer.
   * If this peer is impolite and we are making an offer, we ignore the
   * incoming offer (the remote polite peer will roll back instead).
   *
   * Returns the answer to send back, or null if the offer was ignored.
   */
  async handleOffer(
    offer: RTCSessionDescriptionInit,
  ): Promise<RTCSessionDescriptionInit | null> {
    const offerCollision =
      this.makingOffer || this.pc.signalingState !== "stable";

    if (offerCollision) {
      if (!this.polite) {
        // We are impolite — ignore the incoming offer; the remote (polite)
        // peer will roll back and accept our offer instead.
        console.log(
          `[Peer:${this.peerId}] Glare detected — impolite, ignoring remote offer`,
        );
        return null;
      }

      // We are polite — roll back our pending offer and accept theirs
      console.log(
        `[Peer:${this.peerId}] Glare detected — polite, rolling back local offer`,
      );
      await this.pc.setLocalDescription({ type: "rollback" });
    }

    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.drainIceCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return this.pc.localDescription!;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    // If we've already moved past have-local-offer (e.g. because the polite
    // peer rolled back), silently ignore a stale answer.
    if (this.pc.signalingState !== "have-local-offer") {
      console.log(
        `[Peer:${this.peerId}] Ignoring answer in signalingState ${this.pc.signalingState}`,
      );
      return;
    }
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    await this.drainIceCandidates();
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc.remoteDescription) {
      this.iceCandidateBuffer.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      // Suppress errors for candidates that arrive after rollback
      if (!this.closed) {
        console.warn(
          `[Peer:${this.peerId}] Failed to add ICE candidate:`,
          err,
        );
      }
    }
  }

  private async drainIceCandidates(): Promise<void> {
    const buffered = this.iceCandidateBuffer.splice(0);
    for (const candidate of buffered) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn(
          `[Peer:${this.peerId}] Failed to drain buffered ICE candidate:`,
          err,
        );
      }
    }
  }

  getSenders(): RTCRtpSender[] {
    return this.pc.getSenders();
  }

  // ---- Lifecycle ----

  close(): void {
    this.closed = true;
    this.clearIceDisconnectedTimer();

    // Null out all handlers to prevent callbacks firing after close
    this.pc.onicecandidate = null;
    this.pc.ontrack = null;
    this.pc.onconnectionstatechange = null;
    this.pc.oniceconnectionstatechange = null;
    this.pc.onicegatheringstatechange = null;
    this.pc.onnegotiationneeded = null;

    this.pc.close();
  }

  get connectionState(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  get signalingState(): RTCSignalingState {
    return this.pc.signalingState;
  }

  get isPolite(): boolean {
    return this.polite;
  }
}
