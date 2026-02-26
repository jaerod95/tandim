export type PeerConnectionCallbacks = {
  onIceCandidate: (candidate: RTCIceCandidateInit) => void;
  onTrack: (event: RTCTrackEvent) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onNegotiationNeeded: (offer: RTCSessionDescriptionInit) => void;
};

export class PeerConnectionManager {
  private pc: RTCPeerConnection;
  private iceCandidateBuffer: RTCIceCandidateInit[] = [];
  private makingOffer = false;

  constructor(
    public readonly peerId: string,
    iceConfig: RTCConfiguration,
    private callbacks: PeerConnectionCallbacks,
  ) {
    this.pc = new RTCPeerConnection(iceConfig);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate(event.candidate.toJSON());
      }
    };

    this.pc.ontrack = (event) => {
      this.callbacks.onTrack(event);
    };

    this.pc.onconnectionstatechange = () => {
      this.callbacks.onConnectionStateChange(this.pc.connectionState);
    };

    this.pc.onnegotiationneeded = async () => {
      if (this.makingOffer) return;
      try {
        this.makingOffer = true;
        const offer = await this.pc.createOffer();
        if (this.pc.signalingState !== "stable") return;
        await this.pc.setLocalDescription(offer);
        if (this.pc.localDescription) {
          this.callbacks.onNegotiationNeeded(this.pc.localDescription);
        }
      } catch (err) {
        console.error(`[PeerConnection:${this.peerId}] negotiation error:`, err);
      } finally {
        this.makingOffer = false;
      }
    };
  }

  addTrack(track: MediaStreamTrack, stream: MediaStream): RTCRtpSender {
    return this.pc.addTrack(track, stream);
  }

  removeTrack(sender: RTCRtpSender): void {
    this.pc.removeTrack(sender);
  }

  async replaceTrack(sender: RTCRtpSender, newTrack: MediaStreamTrack): Promise<void> {
    await sender.replaceTrack(newTrack);
  }

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

  async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    await this.drainIceCandidates();
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return this.pc.localDescription!;
  }

  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    await this.drainIceCandidates();
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc.remoteDescription) {
      this.iceCandidateBuffer.push(candidate);
      return;
    }
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  private async drainIceCandidates(): Promise<void> {
    const buffered = this.iceCandidateBuffer.splice(0);
    for (const candidate of buffered) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  close(): void {
    this.pc.close();
  }

  get connectionState(): RTCPeerConnectionState {
    return this.pc.connectionState;
  }

  get signalingState(): RTCSignalingState {
    return this.pc.signalingState;
  }
}
