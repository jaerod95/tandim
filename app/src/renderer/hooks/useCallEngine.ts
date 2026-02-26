import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CallEngine, type CrosstalkInfo } from "@/webrtc/CallEngine";
import type { CallSession, SignalPeer, RemoteTile, PresenceEntry } from "@/renderer/types";

export type UseCallEngineReturn = {
  status: string;
  joined: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  localStream: MediaStream | null;
  remoteTiles: RemoteTile[];
  screenShareTile: RemoteTile | null;
  presence: PresenceEntry[];
  activeScreenSharerUserId: string | null;
  activeCrosstalks: CrosstalkInfo[];
  myCrosstalk: CrosstalkInfo | null;
  toggleMic: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  startCrosstalk: (targetUserIds: string[]) => void;
  endCrosstalk: (crosstalkId: string) => void;
  leave: () => void;
};

export function useCallEngine(session: CallSession | null): UseCallEngineReturn {
  const engineRef = useRef<CallEngine | null>(null);
  const [status, setStatus] = useState("Initializing...");
  const [joined, setJoined] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteTiles, setRemoteTiles] = useState<RemoteTile[]>([]);
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  const [activeScreenSharerUserId, setActiveScreenSharerUserId] = useState<string | null>(null);
  const [screenShareTile, setScreenShareTile] = useState<RemoteTile | null>(null);
  const [activeCrosstalks, setActiveCrosstalks] = useState<CrosstalkInfo[]>([]);
  const tileVersionRef = useRef(0);

  useEffect(() => {
    if (!session) return;

    const engine = new CallEngine(session, {
      onStatusChange: setStatus,
      onPeerJoined: (peer: SignalPeer) => {
        setPresence((prev) => [
          ...prev.filter((p) => p.userId !== peer.userId),
          { userId: peer.userId, displayName: peer.displayName, state: "connected" },
        ]);
      },
      onPeerLeft: (userId: string) => {
        setPresence((prev) => prev.filter((p) => p.userId !== userId));
        setRemoteTiles((prev) => prev.filter((t) => t.userId !== userId));
      },
      onRemoteStream: (userId: string, stream: MediaStream) => {
        tileVersionRef.current += 1;
        const version = tileVersionRef.current;
        setRemoteTiles((prev) => {
          const existing = prev.find((t) => t.userId === userId);
          const displayName = presence.find((p) => p.userId === userId)?.displayName ?? userId;
          if (existing) {
            return prev.map((t) => t.userId === userId ? { ...t, stream, version } : t);
          }
          return [...prev, { userId, displayName, stream, version }];
        });
      },
      onRemoteStreamRemoved: (userId: string) => {
        setRemoteTiles((prev) => prev.filter((t) => t.userId !== userId));
      },
      onRemoteScreenStream: (userId: string, stream: MediaStream) => {
        tileVersionRef.current += 1;
        const displayName = presence.find((p) => p.userId === userId)?.displayName ?? userId;
        setScreenShareTile({ userId, displayName, stream, version: tileVersionRef.current });
      },
      onRemoteScreenStreamRemoved: () => {
        setScreenShareTile(null);
      },
      onScreenShareStarted: (userId: string) => {
        setActiveScreenSharerUserId(userId);
      },
      onScreenShareStopped: () => {
        setActiveScreenSharerUserId(null);
        setScreenShareTile(null);
        setScreenSharing(false);
      },
      onJoined: (peers: SignalPeer[]) => {
        setJoined(true);
        setPresence(
          peers
            .filter((p) => p.userId !== session.userId)
            .map((p) => ({
              userId: p.userId,
              displayName: p.displayName,
              state: "connected" as const,
            })),
        );
      },
      onDisconnected: () => {
        setJoined(false);
      },
      onLocalStream: (stream: MediaStream) => {
        setLocalStream(stream);
      },
      onCrosstalksChanged: (crosstalks: CrosstalkInfo[]) => {
        setActiveCrosstalks(crosstalks);
      },
    });

    engineRef.current = engine;
    engine.join();

    return () => {
      engine.leave();
      engineRef.current = null;
    };
  }, [session]);

  const toggleMic = useCallback(() => {
    if (engineRef.current) {
      const enabled = engineRef.current.toggleMic();
      setMicEnabled(enabled);
    }
  }, []);

  const toggleCamera = useCallback(async () => {
    if (engineRef.current) {
      const enabled = await engineRef.current.toggleCamera();
      setCameraEnabled(enabled);
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (engineRef.current) {
      const sharing = await engineRef.current.toggleScreenShare();
      setScreenSharing(sharing);
    }
  }, []);

  const leave = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.leave();
      engineRef.current = null;
    }
  }, []);

  const startCrosstalk = useCallback((targetUserIds: string[]) => {
    if (engineRef.current) {
      engineRef.current.startCrosstalk(targetUserIds);
    }
  }, []);

  const endCrosstalk = useCallback((crosstalkId: string) => {
    if (engineRef.current) {
      engineRef.current.endCrosstalk(crosstalkId);
    }
  }, []);

  const myCrosstalk = useMemo(() => {
    if (!session) return null;
    return activeCrosstalks.find(
      (ct) => ct.participantUserIds.includes(session.userId)
    ) ?? null;
  }, [activeCrosstalks, session]);

  return {
    status,
    joined,
    micEnabled,
    cameraEnabled,
    screenSharing,
    localStream,
    remoteTiles,
    screenShareTile,
    presence,
    activeScreenSharerUserId,
    activeCrosstalks,
    myCrosstalk,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    startCrosstalk,
    endCrosstalk,
    leave,
  };
}
