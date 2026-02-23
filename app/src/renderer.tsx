import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { io, type Socket } from "socket.io-client";
import "./index.css";

type SignalPeer = { userId: string; displayName: string };
type IceConfig = { iceServers: RTCIceServer[] };
type PresenceEntry = { userId: string; displayName: string; state: "you" | "connected" };
type RemoteTile = { userId: string; displayName: string; stream: MediaStream };
type CallSession = { apiUrl: string; workspaceId: string; roomId: string; displayName: string; userId: string };

const ROOMS = ["Team Standup", "Lounge", "Meeting Room", "Help Needed", "Coffee Break", "Library - Co-Working"];

function LobbyApp() {
  const [apiUrl, setApiUrl] = useState("http://localhost:3000");
  const [workspaceId, setWorkspaceId] = useState("team-local");
  const [displayName, setDisplayName] = useState("Jrod");
  const [selectedRoom, setSelectedRoom] = useState("Team Standup");
  const [status, setStatus] = useState("Pick a room and click Join");

  useEffect(() => {
    window.tandem?.getPendingRoom().then((pending) => {
      if (pending) {
        setSelectedRoom(pending);
      }
    });
    window.tandem?.onDeepLinkRoom((nextRoom) => {
      setSelectedRoom(nextRoom);
      setStatus(`Loaded deep link room ${nextRoom}`);
    });
  }, []);

  async function joinSelectedRoom(): Promise<void> {
    const payload: CallSession = {
      apiUrl: apiUrl.trim(),
      workspaceId: workspaceId.trim(),
      roomId: selectedRoom,
      displayName: displayName.trim() || "Engineer",
      userId: `u-${Math.random().toString(36).slice(2, 8)}`
    };
    await window.tandem?.openCallWindow(payload);
    setStatus(`Opened call window for ${selectedRoom}`);
  }

  return (
    <main className="tandem-shell">
      <header className="topbar">
        <span>Personal Team</span>
      </header>
      <section className="lobby">
        <aside className="rooms-col">
          <div className="rooms-header">
            <span>Rooms</span>
            <button className="small-btn">+</button>
          </div>
          <ul className="rooms-list">
            {ROOMS.map((room) => (
              <li key={room} className={room === selectedRoom ? "active" : ""} onClick={() => setSelectedRoom(room)}>
                <span>🔊</span>
                <span>{room}</span>
                {room === selectedRoom ? <button className="join-inline" onClick={() => void joinSelectedRoom()}>Join</button> : null}
              </li>
            ))}
          </ul>
        </aside>

        <section className="team-col">
          <div className="panel-title">Team</div>
          <div className="member">🟢 {displayName} (you)</div>
          <div className="member">⚪ Jordan</div>
          <button className="primary wide">Invite Teammates</button>
        </section>

        <aside className="details-col">
          <h3>{selectedRoom}</h3>
          <button className="primary wide" onClick={() => void joinSelectedRoom()}>
            Join
          </button>
          <button className="ghost wide">Join w/o audio</button>
          <p className="description">Come here to run your team standup. This panel mirrors Tandem room details.</p>
          <label className="field">
            <span>API URL</span>
            <input value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
          </label>
          <label className="field">
            <span>Workspace ID</span>
            <input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} />
          </label>
          <label className="field">
            <span>Display name</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
          <p className="status">{status}</p>
        </aside>
      </section>
    </main>
  );
}

function CallApp() {
  const [status, setStatus] = useState("Connecting...");
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [remoteTiles, setRemoteTiles] = useState<RemoteTile[]>([]);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [session, setSession] = useState<CallSession | null>(null);
  const [joined, setJoined] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerNamesRef = useRef<Map<string, string>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const heartbeatTimerRef = useRef<number | undefined>(undefined);

  const sortedPresence = useMemo(
    () =>
      [...presence].sort((a, b) => {
        if (a.state === "you" && b.state !== "you") return -1;
        if (a.state !== "you" && b.state === "you") return 1;
        return a.displayName.localeCompare(b.displayName);
      }),
    [presence]
  );

  useEffect(() => {
    const hash = window.location.hash;
    const sessionId = hash.includes("?") ? new URLSearchParams(hash.split("?")[1]).get("sessionId") : null;
    if (!sessionId) {
      setStatus("Missing session id");
      return;
    }
    window.tandem?.getCallSession(sessionId).then(async (loaded) => {
      if (!loaded) {
        setStatus("Call session not found");
        return;
      }
      setSession(loaded);
      await joinCall(loaded);
    });

    return () => {
      cleanupCallState();
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = () => {
      cleanupCallState();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  async function joinCall(current: CallSession): Promise<void> {
    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      const socket = io(current.apiUrl, { path: "/api/signal", transports: ["websocket"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("signal:join", {
          workspaceId: current.workspaceId,
          roomId: current.roomId,
          userId: current.userId,
          displayName: current.displayName
        });
      });

      socket.on("signal:joined", async (payload: { peers: SignalPeer[] }) => {
        setPresence([{ userId: current.userId, displayName: current.displayName, state: "you" }]);
        setJoined(true);
        setStatus("Connected");
        for (const peer of payload.peers) {
          if (peer.userId === current.userId) continue;
          peerNamesRef.current.set(peer.userId, peer.displayName);
          setPresence((prev) => upsertPresence(prev, { ...peer, state: "connected" }));
          await ensurePeerConnection(current, peer.userId, false);
        }
        startHeartbeat();
      });

      socket.on("signal:peer-joined", async (peer: SignalPeer) => {
        if (!session || peer.userId === session.userId) return;
        peerNamesRef.current.set(peer.userId, peer.displayName);
        setPresence((prev) => upsertPresence(prev, { ...peer, state: "connected" }));
        await ensurePeerConnection(session, peer.userId, true);
      });

      socket.on("signal:offer", async (payload: { fromUserId: string; payload: RTCSessionDescriptionInit }) => {
        if (!session) return;
        const pc = await ensurePeerConnection(session, payload.fromUserId, false);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("signal:answer", {
          workspaceId: session.workspaceId,
          roomId: session.roomId,
          toUserId: payload.fromUserId,
          payload: answer
        });
      });

      socket.on("signal:answer", async (payload: { fromUserId: string; payload: RTCSessionDescriptionInit }) => {
        const pc = peersRef.current.get(payload.fromUserId);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.payload));
      });

      socket.on("signal:ice-candidate", async (payload: { fromUserId: string; payload: RTCIceCandidateInit }) => {
        const pc = peersRef.current.get(payload.fromUserId);
        if (pc) await pc.addIceCandidate(new RTCIceCandidate(payload.payload));
      });

      socket.on("signal:peer-left", (payload: { userId: string }) => {
        removePeer(payload.userId);
        setPresence((prev) => prev.filter((entry) => entry.userId !== payload.userId));
      });

      socket.on("disconnect", () => {
        setJoined(false);
        setStatus("Disconnected");
      });
    } catch (error) {
      setStatus(`Failed: ${(error as Error).message}`);
    }
  }

  async function ensurePeerConnection(current: CallSession, peerUserId: string, createOffer: boolean): Promise<RTCPeerConnection> {
    const existing = peersRef.current.get(peerUserId);
    if (existing) return existing;
    const response = await fetch(`${current.apiUrl}/api/ice-config`);
    const ice = (await response.json()) as IceConfig;
    const pc = new RTCPeerConnection(ice);
    peersRef.current.set(peerUserId, pc);

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      socketRef.current?.emit("signal:ice-candidate", {
        workspaceId: current.workspaceId,
        roomId: current.roomId,
        toUserId: peerUserId,
        payload: event.candidate.toJSON()
      });
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
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
        workspaceId: current.workspaceId,
        roomId: current.roomId,
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

  function cleanupCallState(): void {
    for (const userId of Array.from(peersRef.current.keys())) {
      removePeer(userId);
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    if (heartbeatTimerRef.current) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = undefined;
    }
    for (const track of localStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    for (const track of screenStreamRef.current?.getTracks() ?? []) {
      track.stop();
    }
    localStreamRef.current = null;
    screenStreamRef.current = null;
  }

  function startHeartbeat(): void {
    if (heartbeatTimerRef.current) {
      window.clearInterval(heartbeatTimerRef.current);
    }
    heartbeatTimerRef.current = window.setInterval(() => {
      socketRef.current?.emit("signal:heartbeat");
    }, 15_000);
  }

  async function toggleCamera(): Promise<void> {
    if (!localStreamRef.current || !session) return;
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
    if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    await renegotiateAllPeers(session);
  }

  function toggleMic(): void {
    const next = !micEnabled;
    for (const track of localStreamRef.current?.getAudioTracks() ?? []) {
      track.enabled = next;
    }
    setMicEnabled(next);
  }

  async function toggleScreen(): Promise<void> {
    if (!socketRef.current || !session) return;
    if (screenStreamRef.current) {
      for (const track of screenStreamRef.current.getTracks()) track.stop();
      screenStreamRef.current = null;
      socketRef.current.emit("signal:screen-share-stop");
      setScreenSharing(false);
      await renegotiateAllPeers(session);
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
    await renegotiateAllPeers(session);
  }

  async function renegotiateAllPeers(current: CallSession): Promise<void> {
    const peerUserIds = Array.from(peersRef.current.keys());
    for (const peerUserId of peerUserIds) {
      removePeer(peerUserId);
      await ensurePeerConnection(current, peerUserId, true);
    }
  }

  return (
    <main className="call-shell">
      <header className="call-topbar">
        <div>{session?.roomId ?? "Call"}</div>
        <div className="status">{status}</div>
      </header>
      <section className="call-stage">
        <article className="tile large">
          <h2>You</h2>
          <video ref={localVideoRef} autoPlay muted playsInline />
        </article>
        <section className="remote-grid">
          {remoteTiles.map((tile) => (
            <RemoteVideo key={tile.userId} label={tile.displayName} stream={tile.stream} />
          ))}
        </section>
      </section>
      <footer className="call-controls">
        <button onClick={() => toggleMic()} disabled={!joined}>{micEnabled ? "Mute" : "Unmute"}</button>
        <button onClick={() => void toggleCamera()} disabled={!joined}>
          {cameraEnabled ? "Camera Off" : "Camera On"}
        </button>
        <button onClick={() => void toggleScreen()} disabled={!joined}>
          {screenSharing ? "Stop Share" : "Share Screen"}
        </button>
        <button className="danger" onClick={() => window.close()}>
          Leave
        </button>
      </footer>
      <aside className="presence-strip">
        {sortedPresence.map((entry) => (
          <span key={entry.userId}>{entry.displayName}</span>
        ))}
      </aside>
    </main>
  );
}

function RemoteVideo(props: { label: string; stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = props.stream;
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

const mode = window.location.hash.startsWith("#call") ? "call" : "lobby";
const mount = document.getElementById("root");
if (!mount) throw new Error("Missing root container");
createRoot(mount).render(mode === "call" ? <CallApp /> : <LobbyApp />);

