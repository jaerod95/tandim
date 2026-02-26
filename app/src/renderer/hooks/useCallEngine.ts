import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { CallEngine } from "@/webrtc/CallEngine";
import type { CallSession, Crosstalk, SignalPeer, RemoteTile, PresenceEntry } from "@/renderer/types";

export type UseCallEngineReturn = {
  status: string;
  joined: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenSharing: boolean;
  localStream: MediaStream | null;
  localUserId: string | null;
  remoteTiles: RemoteTile[];
  screenShareTile: RemoteTile | null;
  presence: PresenceEntry[];
  activeScreenSharerUserId: string | null;
  activeCrosstalks: Crosstalk[];
  myActiveCrosstalk: Crosstalk | null;
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
  const [activeCrosstalks, setActiveCrosstalks] = useState<Crosstalk[]>([]);
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
      onCrosstalkStarted: (crosstalk: Crosstalk) => {
        setActiveCrosstalks((prev) => [
          ...prev.filter((ct) => ct.id !== crosstalk.id),
          crosstalk,
        ]);
      },
      onCrosstalkEnded: (crosstalkId: string) => {
        setActiveCrosstalks((prev) => prev.filter((ct) => ct.id !== crosstalkId));
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

  const startCrosstalk = useCallback((targetUserIds: string[]) => {
    engineRef.current?.startCrosstalk(targetUserIds);
  }, []);

  const endCrosstalk = useCallback((crosstalkId: string) => {
    engineRef.current?.endCrosstalk(crosstalkId);
  }, []);

  const leave = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.leave();
      engineRef.current = null;
    }
  }, []);

  const localUserId = session?.userId ?? null;

  const myActiveCrosstalk = useMemo(() => {
    if (!localUserId) return null;
    return activeCrosstalks.find((ct) => ct.participantUserIds.includes(localUserId)) ?? null;
  }, [activeCrosstalks, localUserId]);

  return {
    status,
    joined,
    micEnabled,
    cameraEnabled,
    screenSharing,
    localStream,
    localUserId,
    remoteTiles,
    screenShareTile,
    presence,
    activeScreenSharerUserId,
    activeCrosstalks,
    myActiveCrosstalk,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    startCrosstalk,
    endCrosstalk,
    leave,
  };
}
