import { io, type Socket } from "socket.io-client";
import "./index.css";

type SignalPeer = { userId: string; displayName: string };
type IceConfig = { iceServers: RTCIceServer[] };

const state = {
  socket: null as Socket | null,
  workspaceId: "",
  roomId: "",
  userId: `u-${Math.random().toString(36).slice(2, 8)}`,
  displayName: "",
  apiUrl: "",
  localStream: null as MediaStream | null,
  screenStream: null as MediaStream | null,
  peers: new Map<string, RTCPeerConnection>(),
  remoteStreams: new Map<string, MediaStream>(),
  heartbeatTimer: 0 as number | undefined,
  micEnabled: true,
  cameraEnabled: false
};

const els = {
  apiUrl: must<HTMLInputElement>("api-url"),
  workspaceId: must<HTMLInputElement>("workspace-id"),
  roomId: must<HTMLInputElement>("room-id"),
  displayName: must<HTMLInputElement>("display-name"),
  joinButton: must<HTMLButtonElement>("join-button"),
  leaveButton: must<HTMLButtonElement>("leave-button"),
  toggleMic: must<HTMLButtonElement>("toggle-mic"),
  toggleCamera: must<HTMLButtonElement>("toggle-camera"),
  toggleScreen: must<HTMLButtonElement>("toggle-screen"),
  localVideo: must<HTMLVideoElement>("local-video"),
  remoteVideos: must<HTMLDivElement>("remote-videos"),
  status: must<HTMLParagraphElement>("status")
};

els.joinButton.addEventListener("click", joinRoom);
els.leaveButton.addEventListener("click", leaveRoom);
els.toggleMic.addEventListener("click", toggleMic);
els.toggleCamera.addEventListener("click", toggleCamera);
els.toggleScreen.addEventListener("click", toggleScreenShare);

wireDeepLinks();
refreshButtons();
setStatus("Ready");

async function joinRoom(): Promise<void> {
  if (state.socket) {
    return;
  }

  state.apiUrl = els.apiUrl.value.trim();
  state.workspaceId = els.workspaceId.value.trim();
  state.roomId = els.roomId.value.trim();
  state.displayName = els.displayName.value.trim() || "Engineer";
  if (!state.apiUrl || !state.workspaceId || !state.roomId) {
    setStatus("Missing API/workspace/room");
    return;
  }

  try {
    state.localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false
    });
    els.localVideo.srcObject = state.localStream;

    const socket = io(state.apiUrl, {
      path: "/api/signal",
      transports: ["websocket"]
    });
    state.socket = socket;

    socket.on("connect", () => {
      socket.emit("signal:join", {
        workspaceId: state.workspaceId,
        roomId: state.roomId,
        userId: state.userId,
        displayName: state.displayName
      });
      setStatus("Connected to signaling");
    });

    socket.on("signal:joined", async (payload: { peers: SignalPeer[] }) => {
      const existingPeers = payload.peers.filter((peer) => peer.userId !== state.userId);
      for (const peer of existingPeers) {
        await ensurePeerConnection(peer.userId, true);
      }
      startHeartbeat();
      setStatus(`Joined ${state.roomId}`);
    });

    socket.on("signal:peer-joined", async (payload: SignalPeer) => {
      if (payload.userId === state.userId) {
        return;
      }
      await ensurePeerConnection(payload.userId, true);
      setStatus(`${payload.displayName} joined`);
    });

    socket.on(
      "signal:offer",
      async (payload: { fromUserId: string; payload: RTCSessionDescriptionInit }) => {
        const pc = await ensurePeerConnection(payload.fromUserId, false);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        state.socket?.emit("signal:answer", {
          workspaceId: state.workspaceId,
          roomId: state.roomId,
          toUserId: payload.fromUserId,
          payload: answer
        });
      }
    );

    socket.on(
      "signal:answer",
      async (payload: { fromUserId: string; payload: RTCSessionDescriptionInit }) => {
        const pc = state.peers.get(payload.fromUserId);
        if (!pc) {
          return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
      }
    );

    socket.on(
      "signal:ice-candidate",
      async (payload: { fromUserId: string; payload: RTCIceCandidateInit }) => {
        const pc = state.peers.get(payload.fromUserId);
        if (!pc) {
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(payload.payload));
      }
    );

    socket.on(
      "signal:peer-left",
      (payload: { userId: string; activeScreenSharerUserId: string | null }) => {
        removePeer(payload.userId);
        if (!payload.activeScreenSharerUserId) {
          els.toggleScreen.textContent = "Share screen";
        }
      }
    );

    socket.on("signal:screen-share-started", (payload: { userId: string }) => {
      if (payload.userId !== state.userId) {
        setStatus(`User ${payload.userId} started screen sharing`);
      }
    });

    socket.on("signal:screen-share-stopped", () => {
      setStatus("Screen sharing stopped");
    });

    socket.on("signal:error", (payload: { message: string }) => {
      setStatus(`Signal error: ${payload.message}`);
    });

    socket.on("disconnect", () => {
      stopHeartbeat();
      setStatus("Disconnected");
    });

    refreshButtons();
  } catch (error) {
    setStatus(`Join failed: ${(error as Error).message}`);
  }
}

async function ensurePeerConnection(peerUserId: string, createOffer: boolean): Promise<RTCPeerConnection> {
  const existing = state.peers.get(peerUserId);
  if (existing) {
    return existing;
  }

  const iceConfig = await fetchIceConfig();
  const pc = new RTCPeerConnection(iceConfig);
  state.peers.set(peerUserId, pc);

  pc.onicecandidate = (event) => {
    if (!event.candidate) {
      return;
    }
    state.socket?.emit("signal:ice-candidate", {
      workspaceId: state.workspaceId,
      roomId: state.roomId,
      toUserId: peerUserId,
      payload: event.candidate.toJSON()
    });
  };

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (!stream) {
      return;
    }
    state.remoteStreams.set(peerUserId, stream);
    renderRemoteStream(peerUserId, stream);
  };

  for (const track of state.localStream?.getTracks() ?? []) {
    pc.addTrack(track, state.localStream as MediaStream);
  }

  if (state.screenStream) {
    for (const track of state.screenStream.getVideoTracks()) {
      pc.addTrack(track, state.screenStream);
    }
  }

  if (createOffer) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    state.socket?.emit("signal:offer", {
      workspaceId: state.workspaceId,
      roomId: state.roomId,
      toUserId: peerUserId,
      payload: offer
    });
  }

  return pc;
}

async function fetchIceConfig(): Promise<IceConfig> {
  const response = await fetch(`${state.apiUrl}/api/ice-config`);
  if (!response.ok) {
    throw new Error(`ICE config failed (${response.status})`);
  }
  return (await response.json()) as IceConfig;
}

function removePeer(userId: string): void {
  const pc = state.peers.get(userId);
  if (pc) {
    pc.close();
    state.peers.delete(userId);
  }
  state.remoteStreams.delete(userId);
  const tile = document.getElementById(`remote-${userId}`);
  if (tile) {
    tile.remove();
  }
}

function renderRemoteStream(userId: string, stream: MediaStream): void {
  let tile = document.getElementById(`remote-${userId}`) as HTMLDivElement | null;
  let video: HTMLVideoElement | null = tile?.querySelector("video") ?? null;

  if (!tile) {
    tile = document.createElement("article");
    tile.id = `remote-${userId}`;
    tile.className = "tile";
    tile.innerHTML = `<h2>${userId}</h2><video autoplay playsinline></video>`;
    els.remoteVideos.appendChild(tile);
    video = tile.querySelector("video");
  }

  if (video) {
    video.srcObject = stream;
  }
}

function leaveRoom(): void {
  for (const userId of Array.from(state.peers.keys())) {
    removePeer(userId);
  }
  state.socket?.disconnect();
  state.socket = null;
  stopHeartbeat();
  for (const track of state.localStream?.getTracks() ?? []) {
    track.stop();
  }
  for (const track of state.screenStream?.getTracks() ?? []) {
    track.stop();
  }
  state.localStream = null;
  state.screenStream = null;
  els.localVideo.srcObject = null;
  els.remoteVideos.innerHTML = "";
  setStatus("Left room");
  refreshButtons();
}

function toggleMic(): void {
  if (!state.localStream) {
    return;
  }
  state.micEnabled = !state.micEnabled;
  for (const track of state.localStream.getAudioTracks()) {
    track.enabled = state.micEnabled;
  }
  els.toggleMic.textContent = state.micEnabled ? "Mute mic" : "Unmute mic";
}

async function toggleCamera(): Promise<void> {
  if (!state.localStream) {
    return;
  }

  if (state.cameraEnabled) {
    for (const track of state.localStream.getVideoTracks()) {
      track.stop();
      state.localStream.removeTrack(track);
    }
    state.cameraEnabled = false;
    els.toggleCamera.textContent = "Enable camera";
  } else {
    const cam = await navigator.mediaDevices.getUserMedia({ video: true });
    const track = cam.getVideoTracks()[0];
    if (!track) {
      return;
    }
    state.localStream.addTrack(track);
    state.cameraEnabled = true;
    els.toggleCamera.textContent = "Disable camera";
  }

  els.localVideo.srcObject = state.localStream;
  await renegotiateAllPeers();
}

async function toggleScreenShare(): Promise<void> {
  if (!state.socket) {
    return;
  }

  if (state.screenStream) {
    for (const track of state.screenStream.getTracks()) {
      track.stop();
    }
    state.screenStream = null;
    state.socket.emit("signal:screen-share-stop");
    els.toggleScreen.textContent = "Share screen";
    await renegotiateAllPeers();
    return;
  }

  state.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
  const track = state.screenStream.getVideoTracks()[0];
  if (track) {
    track.onended = () => {
      void toggleScreenShare();
    };
  }
  state.socket.emit("signal:screen-share-start");
  els.toggleScreen.textContent = "Stop sharing";
  await renegotiateAllPeers();
}

async function renegotiateAllPeers(): Promise<void> {
  for (const [peerUserId] of state.peers.entries()) {
    const oldPc = state.peers.get(peerUserId);
    if (oldPc) {
      oldPc.close();
      state.peers.delete(peerUserId);
    }
    await ensurePeerConnection(peerUserId, true);
  }
}

function startHeartbeat(): void {
  stopHeartbeat();
  state.heartbeatTimer = window.setInterval(() => {
    state.socket?.emit("signal:heartbeat");
  }, 15_000);
}

function stopHeartbeat(): void {
  if (state.heartbeatTimer) {
    window.clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = undefined;
  }
}

function refreshButtons(): void {
  const inRoom = Boolean(state.socket);
  els.joinButton.disabled = inRoom;
  els.leaveButton.disabled = !inRoom;
  els.toggleMic.disabled = !inRoom;
  els.toggleCamera.disabled = !inRoom;
  els.toggleScreen.disabled = !inRoom;
}

function setStatus(value: string): void {
  els.status.textContent = value;
}

function must<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) {
    throw new Error(`Missing element ${id}`);
  }
  return found as T;
}

async function wireDeepLinks(): Promise<void> {
  const pending = await window.tandem?.getPendingRoom();
  if (pending) {
    els.roomId.value = pending;
  }
  window.tandem?.onDeepLinkRoom((roomId) => {
    els.roomId.value = roomId;
    setStatus(`Deep link loaded room ${roomId}`);
  });
}
