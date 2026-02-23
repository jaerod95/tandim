import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io, type Socket } from "socket.io-client";
import "./index.css";

type SignalPeer = { userId: string; displayName: string };
type IceConfig = { iceServers: RTCIceServer[] };
type PresenceEntry = { userId: string; displayName: string; state: "you" | "connected" };
type RemoteTile = { userId: string; displayName: string; stream: MediaStream };

function App(): JSX.Element {
  const [apiUrl, setApiUrl] = useState("http://localhost:3000");
  const [workspaceId, setWorkspaceId] = useState("team-local");
  const [roomId, setRoomId] = useState("daily-sync");
  const [displayName, setDisplayName] = useState("Engineer");
  const [status, setStatus] = useState("Ready");
  const [joined, setJoined] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [remoteTiles, setRemoteTiles] = useState<RemoteTile[]>([]);

  const userIdRef = useRef(`u-${Math.random().toString(36).slice(2, 8)}`);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerNamesRef = useRef<Map<string, string>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const heartbeatTimerRef = useRef<number | undefined>(undefined);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const sortedPresence = useMemo(
    () =>
      [...presence].sort((a, b) => {
        if (a.state === "you" && b.state !== "you") {
          return -1;
        }
        if (a.state !== "you" && b.state === "you") {
          return 1;
        }
        return a.displayName.localeCompare(b.displayName);
      }),
    [presence]
  );

  useEffect(() => {
    let mounted = true;
    window.tandem?.getPendingRoom().then((pending) => {
      if (mounted && pending) {
        setRoomId(pending);
      }
    });
    window.tandem?.onDeepLinkRoom((nextRoom) => {
      setRoomId(nextRoom);
      setStatus(`Deep link loaded room ${nextRoom}`);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [joined, cameraEnabled]);

  useEffect(
    () => () => {
      void leaveRoom();
    },
    []
  );

  async function joinRoom(): Promise<void> {
    if (socketRef.current) {
      return;
    }
    if (!apiUrl.trim() || !workspaceId.trim() || !roomId.trim()) {
      setStatus("Missing API/workspace/room");
      return;
    }

    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      const socket = io(apiUrl.trim(), { path: "/api/signal", transports: ["websocket"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("signal:join", {
          workspaceId: workspaceId.trim(),
          roomId: roomId.trim(),
          userId: userIdRef.current,
          displayName: displayName.trim() || "Engineer"
        });
        setStatus("Connected to signaling");
      });

      socket.on("signal:joined", async (payload: { peers: SignalPeer[] }) => {
        setPresence([{ userId: userIdRef.current, displayName: displayName.trim() || "Engineer", state: "you" }]);
        for (const peer of payload.peers) {
          if (peer.userId === userIdRef.current) {
            continue;
          }
          peerNamesRef.current.set(peer.userId, peer.displayName);
          setPresence((prev) => upsertPresence(prev, { ...peer, state: "connected" }));
          await ensurePeerConnection(peer.userId, true);
        }
        startHeartbeat();
        setJoined(true);
        setStatus(`Joined ${roomId.trim()}`);
      });

      socket.on("signal:peer-joined", async (peer: SignalPeer) => {
        if (peer.userId === userIdRef.current) {
          return;
        }
        peerNamesRef.current.set(peer.userId, peer.displayName);
        setPresence((prev) => upsertPresence(prev, { ...peer, state: "connected" }));
        await ensurePeerConnection(peer.userId, true);
        setStatus(`${peer.displayName} joined`);
      });

      socket.on("signal:offer", async (payload: { fromUserId: string; payload: RTCSessionDescriptionInit }) => {
        const pc = await ensurePeerConnection(payload.fromUserId, false);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("signal:answer", {
          workspaceId: workspaceId.trim(),
          roomId: roomId.trim(),
          toUserId: payload.fromUserId,
          payload: answer
        });
      });

      socket.on("signal:answer", async (payload: { fromUserId: string; payload: RTCSessionDescriptionInit }) => {
        const pc = peersRef.current.get(payload.fromUserId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
        }
      });

      socket.on("signal:ice-candidate", async (payload: { fromUserId: string; payload: RTCIceCandidateInit }) => {
        const pc = peersRef.current.get(payload.fromUserId);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.payload));
        }
      });

      socket.on("signal:peer-left", (payload: { userId: string; activeScreenSharerUserId: string | null }) => {
        removePeer(payload.userId);
        setPresence((prev) => prev.filter((entry) => entry.userId !== payload.userId));
        if (!payload.activeScreenSharerUserId) {
          setScreenSharing(false);
        }
      });

      socket.on("signal:screen-share-started", (payload: { userId: string }) => {
        if (payload.userId !== userIdRef.current) {
          setStatus(`${peerNamesRef.current.get(payload.userId) ?? payload.userId} started screen share`);
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
        setJoined(false);
        setStatus("Disconnected");
      });
    } catch (error) {
      setStatus(`Join failed: ${(error as Error).message}`);
    }
  }

  async function ensurePeerConnection(peerUserId: string, createOffer: boolean): Promise<RTCPeerConnection> {
    const existing = peersRef.current.get(peerUserId);
    if (existing) {
      return existing;
    }

    const response = await fetch(`${apiUrl.trim()}/api/ice-config`);
    const ice = (await response.json()) as IceConfig;
    const pc = new RTCPeerConnection(ice);
    peersRef.current.set(peerUserId, pc);

    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }
      socketRef.current?.emit("signal:ice-candidate", {
        workspaceId: workspaceId.trim(),
        roomId: roomId.trim(),
        toUserId: peerUserId,
        payload: event.candidate.toJSON()
      });
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) {
        return;
      }
      const display = peerNamesRef.current.get(peerUserId) ?? peerUserId;
      setRemoteTiles((prev) => upsertRemoteTile(prev, { userId: peerUserId, displayName: display, stream }));
    };

    for (const track of localStreamRef.current?.getTracks() ?? []) {
      pc.addTrack(track, localStreamRef.current as MediaStream);
    }
    for (const track of screenStreamRef.current?.getVideoTracks() ?? []) {
      pc.addTrack(track, screenStreamRef.current);
    }

    if (createOffer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit("signal:offer", {
        workspaceId: workspaceId.trim(),
        roomId: roomId.trim(),
        toUserId: peerUserId,
        payload: offer
      });
    }

    return pc;
  }

  function removePeer(userId: string): void {
    const pc = peersRef.current.get(userId);
    if (pc) {
      pc.close();
      peersRef.current.delete(userId);
    }
    peerNamesRef.current.delete(userId);
    setRemoteTiles((prev) => prev.filter((tile) => tile.userId !== userId));
  }

  async function leaveRoom(): Promise<void> {
    for (const userId of Array.from(peersRef.current.keys())) {
      removePeer(userId);
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    stopHeartbeat();

    for (const track of localStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    for (const track of screenStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    localStreamRef.current = null;
    screenStreamRef.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setRemoteTiles([]);
    setPresence([]);
    setJoined(false);
    setMicEnabled(true);
    setCameraEnabled(false);
    setScreenSharing(false);
    setStatus("Left room");
  }

  function startHeartbeat(): void {
    stopHeartbeat();
    heartbeatTimerRef.current = window.setInterval(() => {
      socketRef.current?.emit("signal:heartbeat");
    }, 15_000);
  }

  function stopHeartbeat(): void {
    if (heartbeatTimerRef.current) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = undefined;
    }
  }

  function toggleMic(): void {
    const next = !micEnabled;
    for (const track of localStreamRef.current?.getAudioTracks() ?? []) {
      track.enabled = next;
    }
    setMicEnabled(next);
  }

  async function toggleCamera(): Promise<void> {
    if (!localStreamRef.current) {
      return;
    }

    if (cameraEnabled) {
      for (const track of localStreamRef.current.getVideoTracks()) {
        track.stop();
        localStreamRef.current.removeTrack(track);
      }
      setCameraEnabled(false);
    } else {
      const cam = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = cam.getVideoTracks()[0];
      if (track) {
        localStreamRef.current.addTrack(track);
        setCameraEnabled(true);
      }
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    await renegotiateAllPeers();
  }

  async function toggleScreen(): Promise<void> {
    if (!socketRef.current) {
      return;
    }

    if (screenStreamRef.current) {
      for (const track of screenStreamRef.current.getTracks()) {
        track.stop();
      }
      screenStreamRef.current = null;
      socketRef.current.emit("signal:screen-share-stop");
      setScreenSharing(false);
      await renegotiateAllPeers();
      return;
    }

    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    const track = screen.getVideoTracks()[0];
    if (track) {
      track.onended = () => {
        void toggleScreen();
      };
    }
    screenStreamRef.current = screen;
    socketRef.current.emit("signal:screen-share-start");
    setScreenSharing(true);
    await renegotiateAllPeers();
  }

  async function renegotiateAllPeers(): Promise<void> {
    const peerUserIds = Array.from(peersRef.current.keys());
    for (const peerUserId of peerUserIds) {
      removePeer(peerUserId);
      await ensurePeerConnection(peerUserId, true);
    }
  }

  async function switchRoom(nextRoom: string): Promise<void> {
    setRoomId(nextRoom);
    if (!joined) {
      setStatus(`Selected room ${nextRoom}`);
      return;
    }
    await leaveRoom();
    await joinRoom();
  }

  return (
    <main className="layout">
      <section className="sidebar">
        <h1>Tandim</h1>
        <p className="subtitle">Presence-first team calling</p>

        <label className="field">
          <span>API URL</span>
          <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
        </label>
        <label className="field">
          <span>Workspace ID</span>
          <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} />
        </label>
        <label className="field">
          <span>Room ID</span>
          <input value={roomId} onChange={(e) => setRoomId(e.target.value)} />
        </label>

        <div className="quick-rooms">
          <span>Quick rooms</span>
          <div className="chip-row">
            {["daily-sync", "pairing", "war-room", "lounge"].map((room) => (
              <button key={room} className="chip" onClick={() => void switchRoom(room)}>
                {room}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Display name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>

        <div className="actions">
          <button onClick={() => void joinRoom()} disabled={joined}>
            Join room
          </button>
          <button onClick={() => void leaveRoom()} disabled={!joined}>
            Leave room
          </button>
        </div>

        <div className="actions">
          <button onClick={() => toggleMic()} disabled={!joined}>
            {micEnabled ? "Mute mic" : "Unmute mic"}
          </button>
          <button onClick={() => void toggleCamera()} disabled={!joined}>
            {cameraEnabled ? "Disable camera" : "Enable camera"}
          </button>
          <button onClick={() => void toggleScreen()} disabled={!joined}>
            {screenSharing ? "Stop sharing" : "Share screen"}
          </button>
        </div>

        <p className="status">{status}</p>

        <section className="presence">
          <h2>In this room</h2>
          <ul>
            {sortedPresence.map((entry) => (
              <li key={entry.userId}>
                <span>{entry.displayName}</span>
                <span className="state">{entry.state}</span>
              </li>
            ))}
          </ul>
        </section>
      </section>

      <section className="content">
        <div className="video-grid">
          <article className="tile">
            <h2>You</h2>
            <video ref={localVideoRef} autoPlay muted playsInline />
          </article>
          <section className="remote-grid">
            {remoteTiles.map((tile) => (
              <RemoteVideo key={tile.userId} label={tile.displayName} stream={tile.stream} />
            ))}
          </section>
        </div>
      </section>
    </main>
  );
}

function RemoteVideo(props: { label: string; stream: MediaStream }): JSX.Element {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = props.stream;
    }
  }, [props.stream]);
  return (
    <article className="tile">
      <h2>{props.label}</h2>
      <video ref={ref} autoPlay playsInline />
    </article>
  );
}

function upsertPresence(current: PresenceEntry[], next: PresenceEntry): PresenceEntry[] {
  const map = new Map(current.map((entry) => [entry.userId, entry]));
  map.set(next.userId, next);
  return Array.from(map.values());
}

function upsertRemoteTile(current: RemoteTile[], next: RemoteTile): RemoteTile[] {
  const map = new Map(current.map((entry) => [entry.userId, entry]));
  map.set(next.userId, next);
  return Array.from(map.values());
}

const rootEl = document.createElement("div");
document.body.innerHTML = "";
document.body.appendChild(rootEl);
createRoot(rootEl).render(<App />);
