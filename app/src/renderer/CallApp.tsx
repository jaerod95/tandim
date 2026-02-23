import React, { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { RemoteVideo } from "./RemoteVideo";
import type { CallSession, IceConfig, PresenceEntry, SignalPeer, RemoteTile } from "./types";
import { upsertPresence, upsertRemoteTile } from "./utils";

export function CallApp() {
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

  const hasOthers = remoteTiles.length > 0;

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

    const onBeforeUnload = () => {
      cleanupCallState();
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      cleanupCallState();
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

  async function ensurePeerConnection(
    current: CallSession,
    peerUserId: string,
    createOffer: boolean
  ): Promise<RTCPeerConnection> {
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

  function toggleMic(): void {
    const next = !micEnabled;
    for (const track of localStreamRef.current?.getAudioTracks() ?? []) {
      track.enabled = next;
    }
    setMicEnabled(next);
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
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    await renegotiateAllPeers(session);
  }

  async function toggleScreen(): Promise<void> {
    if (!socketRef.current || !session) return;
    if (screenStreamRef.current) {
      for (const track of screenStreamRef.current.getTracks()) {
        track.stop();
      }
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
      {/* Top Bar */}
      <header className="call-topbar">
        <div className="call-topbar-left">
          <span className="call-room-name">{session?.roomId ?? "Call"}</span>
          <span className="call-workspace">us-west1-a</span>
        </div>
        <div className="call-topbar-right">
          <button className="call-icon-btn" title="Connection Info">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 8a8 8 0 1116 0A8 8 0 010 8zm8-6a6 6 0 100 12A6 6 0 008 2z"/>
              <path d="M7 4h2v2H7V4zm0 4h2v6H7V8z"/>
            </svg>
          </button>
          <button className="call-icon-btn" title="Notifications">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a1 1 0 011 1v.5A6 6 0 0114.5 8H15a1 1 0 010 2h-1a1 1 0 01-1-1 5 5 0 00-10 0 1 1 0 01-1 1H1a1 1 0 010-2h.5A6 6 0 017 1.5V1a1 1 0 011-1z"/>
              <path d="M6 14a2 2 0 104 0H6z"/>
            </svg>
          </button>
          <button className="call-icon-btn" title="Grid View">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 0h7v7H0V0zm9 0h7v7H9V0zM0 9h7v7H0V9zm9 0h7v7H9V9z"/>
            </svg>
          </button>
          <button className="call-icon-btn" title="Pin">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M9.828.722a.5.5 0 01.354.146l4.95 4.95a.5.5 0 010 .707l-2.12 2.12 2.475 2.475a.5.5 0 01-.707.707L12.5 9.55l-2.12 2.12a.5.5 0 01-.707 0l-4.95-4.95a.5.5 0 010-.707L7.05 3.69 4.575 1.215a.5.5 0 11.707-.707L7.757 2.98l2.121-2.12a.5.5 0 01.354-.146z"/>
            </svg>
          </button>
          <button className="call-icon-btn" title="More">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M3 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
            </svg>
          </button>
        </div>
      </header>

      {/* Main Stage */}
      <section className="call-stage">
        {hasOthers ? (
          <section className="remote-grid">
            {remoteTiles.map((tile) => (
              <RemoteVideo key={tile.userId} label={tile.displayName} stream={tile.stream} />
            ))}
          </section>
        ) : (
          <div className="empty-room">
            <p className="empty-room-text">There's no one here!</p>
          </div>
        )}
      </section>

      {/* Bottom Controls */}
      <footer className="call-controls">
        <div className="call-controls-left">
          <div className="control-group">
            <span className="control-label">Mute</span>
            <button
              className={`control-btn ${!micEnabled ? 'active' : ''}`}
              onClick={() => toggleMic()}
              disabled={!joined}
              title={micEnabled ? "Mute" : "Unmute"}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                {micEnabled ? (
                  <path d="M5 3a3 3 0 016 0v5a3 3 0 01-6 0V3zM3.5 8a.5.5 0 01.5.5 4 4 0 008 0 .5.5 0 011 0 5 5 0 01-4.5 4.975V15h1a.5.5 0 010 1h-3a.5.5 0 010-1h1v-1.525A5 5 0 013 8.5a.5.5 0 01.5-.5z"/>
                ) : (
                  <>
                    <path d="M5 3a3 3 0 016 0v5a3 3 0 01-6 0V3z"/>
                    <path d="M1 1l14 14" stroke="currentColor" strokeWidth="2"/>
                  </>
                )}
              </svg>
            </button>
          </div>

          <div className="control-group">
            <span className="control-label">Camera</span>
            <button
              className={`control-btn ${cameraEnabled ? 'active' : ''}`}
              onClick={() => void toggleCamera()}
              disabled={!joined}
              title={cameraEnabled ? "Turn Camera Off" : "Turn Camera On"}
            >
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                {cameraEnabled ? (
                  <path d="M0 4a2 2 0 012-2h8a2 2 0 012 2v1.586l2.707-2.707a1 1 0 011.707.707v8.828a1 1 0 01-1.707.707L12 10.414V12a2 2 0 01-2 2H2a2 2 0 01-2-2V4z"/>
                ) : (
                  <>
                    <path d="M0 4a2 2 0 012-2h8a2 2 0 012 2v1.586l2.707-2.707a1 1 0 011.707.707v8.828a1 1 0 01-1.707.707L12 10.414V12a2 2 0 01-2 2H2a2 2 0 01-2-2V4z"/>
                    <path d="M1 1l14 14" stroke="currentColor" strokeWidth="2"/>
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        <div className="call-controls-center">
          <div className="control-group">
            <span className="control-label">Screen</span>
            <button
              className={`control-btn large ${screenSharing ? 'active' : ''}`}
              onClick={() => void toggleScreen()}
              disabled={!joined}
              title={screenSharing ? "Stop Sharing" : "Share Screen"}
            >
              <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H2a2 2 0 01-2-2V2zm8 9l2-2H6l2 2z"/>
              </svg>
              {screenSharing && <span className="sharing-indicator">■</span>}
            </button>
          </div>

          <div className="control-group">
            <span className="control-label">Chat</span>
            <button className="control-btn" disabled={!joined} title="Chat">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 2a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4.414l-2.707 2.707A1 1 0 010 14V2z"/>
              </svg>
            </button>
          </div>

          <div className="control-group">
            <span className="control-label">Reactions</span>
            <button className="control-btn" disabled={!joined} title="Reactions">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM5 6a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2zM5.5 10a.5.5 0 01.5-.5h4a.5.5 0 010 1H6a.5.5 0 01-.5-.5z"/>
              </svg>
            </button>
          </div>

          <div className="control-group">
            <span className="control-label">Widgets</span>
            <button className="control-btn" disabled={!joined} title="Widgets">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 0h7v7H0V0zm9 0h7v7H9V0zM0 9h7v7H0V9zm9 0h7v7H9V9z"/>
              </svg>
            </button>
          </div>

          <div className="control-group">
            <span className="control-label">More</span>
            <button className="control-btn" disabled={!joined} title="More">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3 8a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="call-controls-right">
          <button className="leave-btn" onClick={() => window.close()}>
            LEAVE
          </button>
          <div className="current-user">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style={{ marginRight: '6px' }}>
              <path d="M8 0a3 3 0 100 6 3 3 0 000-6z"/>
              <path d="M12 8a2 2 0 00-2-2H6a2 2 0 00-2 2v4a2 2 0 002 2h4a2 2 0 002-2V8z"/>
            </svg>
            {session?.displayName ?? "You"}
          </div>
        </div>
      </footer>
    </main>
  );
}
