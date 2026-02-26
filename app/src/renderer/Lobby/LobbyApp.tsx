import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { LobbySidebar } from "@/renderer/Lobby/LobbySidebar";
import { LobbyHeader } from "@/renderer/Lobby/LobbyHeader";
import { LobbyContent } from "@/renderer/Lobby/LobbyContent";
import { LobbyRightSidebar } from "@/renderer/Lobby/LobbyRightSidebar";
import { UpdateBanner } from "@/renderer/Lobby/UpdateBanner";
import { SettingsDialog } from "@/renderer/Lobby/SettingsDialog";
import { QuickTalkNotification } from "@/renderer/Lobby/QuickTalkNotification";
import { AuthScreen } from "@/renderer/Auth/AuthScreen";
import type { CallSession, Room } from "@/renderer/types";
import { DEFAULT_ROOMS } from "@/renderer/types";
import { usePresence } from "@/hooks/use-presence";
import { useAuth } from "@/hooks/use-auth";
import { useIdleDetector } from "@/hooks/use-idle-detector";
import { useDnd } from "@/hooks/use-dnd";
import { useUserProfile } from "@/hooks/use-user-profile";

const API_URL = "http://localhost:3000";
const WORKSPACE_ID = "team-local";

type RoomParticipant = { userId: string; displayName: string };

type IncomingQuickTalk = {
  roomId: string;
  fromUserId: string;
  fromDisplayName: string;
  workspaceId: string;
};

export function LobbyApp() {
  const auth = useAuth({ apiUrl: API_URL });

  if (auth.isLoading) {
    return (
      <ThemeProvider>
        <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-400">
          Loading...
        </div>
      </ThemeProvider>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <ThemeProvider>
        <AuthScreen
          onLogin={auth.login}
          onRegister={auth.register}
          error={auth.error}
        />
      </ThemeProvider>
    );
  }

  return (
    <AuthenticatedLobby
      userId={auth.user!.userId}
      displayName={auth.user!.displayName}
      getToken={auth.getToken}
      onLogout={auth.logout}
    />
  );
}

function AuthenticatedLobby({
  userId: authUserId,
  displayName: authDisplayName,
  getToken,
  onLogout,
}: {
  userId: string;
  displayName: string;
  getToken: () => string | null;
  onLogout: () => void;
}) {
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [roomOccupancy, setRoomOccupancy] = useState<Map<string, number>>(new Map());
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [serverReachable, setServerReachable] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [incomingQuickTalk, setIncomingQuickTalk] = useState<IncomingQuickTalk | null>(null);
  const { dndActive, toggleDnd } = useDnd();

  const { profile, updateProfile } = useUserProfile({
    apiUrl: API_URL,
    userId: authUserId,
    defaultDisplayName: authDisplayName,
  });

  // Auto-dismiss join error after 5 seconds
  useEffect(() => {
    if (!joinError) return;
    const timeout = setTimeout(() => setJoinError(null), 5000);
    return () => clearTimeout(timeout);
  }, [joinError]);

  const { users, setStatus, socketRef } = usePresence({
    apiUrl: API_URL,
    workspaceId: WORKSPACE_ID,
    userId: authUserId,
    displayName: profile.displayName,
    token: getToken() ?? undefined,
  });

  // Sync DND status with presence
  useEffect(() => {
    if (dndActive) {
      setStatus("dnd");
    } else {
      setStatus("available");
    }
  }, [dndActive, setStatus]);

  // Idle detection (DND takes priority)
  const onIdle = useCallback(() => {
    if (!dndActive) setStatus("idle");
  }, [setStatus, dndActive]);
  const onActive = useCallback(() => {
    if (!dndActive) setStatus("available");
  }, [setStatus, dndActive]);
  useIdleDetector({ onIdle, onActive });

  // Fetch room definitions from API, fall back to defaults
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/room-definitions`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setRooms(data);
          return;
        }
      }
    } catch {
      // Fall back to defaults
    }
    setRooms(DEFAULT_ROOMS);
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Quick talk socket listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleIncoming = (data: IncomingQuickTalk) => {
      setIncomingQuickTalk(data);
    };

    const handleCancelled = () => {
      setIncomingQuickTalk(null);
    };

    const handleAccepted = (data: { roomId: string }) => {
      openCallWindow(data.roomId);
    };

    const handleDeclined = () => {
      setJoinError("Quick talk was declined.");
    };

    socket.on("signal:quick-talk-incoming", handleIncoming);
    socket.on("signal:quick-talk-cancelled", handleCancelled);
    socket.on("signal:quick-talk-accepted", handleAccepted);
    socket.on("signal:quick-talk-declined", handleDeclined);

    return () => {
      socket.off("signal:quick-talk-incoming", handleIncoming);
      socket.off("signal:quick-talk-cancelled", handleCancelled);
      socket.off("signal:quick-talk-accepted", handleAccepted);
      socket.off("signal:quick-talk-declined", handleDeclined);
    };
  }, [socketRef.current]);

  // Derive room occupancy from presence data
  const presenceOccupancy = useMemo(() => {
    const occ = new Map<string, number>();
    for (const user of users) {
      if (user.status === "in-call" && user.currentRoom) {
        const roomId = user.currentRoom.roomId;
        occ.set(roomId, (occ.get(roomId) ?? 0) + 1);
      }
    }
    return occ;
  }, [users]);

  // Poll room occupancy as fallback (also catches non-presence-connected call windows)
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/api/rooms`);
        const data = await res.json();
        const occ = new Map<string, number>();
        for (const room of data.rooms) {
          occ.set(room.roomId, room.peerCount);
        }
        setRoomOccupancy(occ);
        setServerReachable(true);
      } catch {
        setServerReachable(false);
      }
    };
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  // Merge occupancy: prefer presence-derived counts but fall back to polled data
  const mergedOccupancy = useMemo(() => {
    const merged = new Map(roomOccupancy);
    for (const [roomId, count] of presenceOccupancy) {
      // Use the larger of the two counts (presence may not see non-presence clients)
      merged.set(roomId, Math.max(merged.get(roomId) ?? 0, count));
    }
    return merged;
  }, [roomOccupancy, presenceOccupancy]);

  // Fetch participants when a room is selected
  useEffect(() => {
    if (!selectedRoom) {
      setParticipants([]);
      return;
    }

    const fetchParticipants = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/rooms/${encodeURIComponent(WORKSPACE_ID)}/${encodeURIComponent(selectedRoom)}`,
        );
        const data = await res.json();
        setParticipants(data.peers ?? []);
      } catch {
        setParticipants([]);
      }
    };

    fetchParticipants();
    const id = setInterval(fetchParticipants, 5000);
    return () => clearInterval(id);
  }, [selectedRoom]);

  const openCallWindow = useCallback(async (roomId: string, audioEnabled = true) => {
    const payload: CallSession = {
      audioEnabled,
      apiUrl: API_URL,
      workspaceId: WORKSPACE_ID,
      roomId,
      displayName: profile.displayName,
      userId: authUserId,
      token: getToken() ?? undefined,
    };

    try {
      await window.tandim?.openCallWindow(payload);
    } catch (error) {
      console.error("Failed to open call window:", error);
      setJoinError("Failed to open call window. Please try again.");
    }
  }, [profile.displayName, authUserId, getToken]);

  const joinRoom = useCallback(
    async (audioEnabled: boolean) => {
      if (!selectedRoom) return;
      await openCallWindow(selectedRoom, audioEnabled);
    },
    [selectedRoom, openCallWindow],
  );

  // Deep link support
  useEffect(() => {
    // Handle pending deep link from before the window was ready
    window.tandim?.getPendingDeepLink().then((pending) => {
      if (!pending) return;

      switch (pending.type) {
        case "join-room":
          void openCallWindow(pending.roomId);
          break;
        case "view-room":
          setSelectedRoom(pending.roomId);
          break;
        case "workspace":
          console.log("Deep link workspace switch:", pending.workspaceId);
          break;
      }
    });

    // Live deep link events while window is open
    window.tandim?.onDeepLinkRoom((roomId) => {
      setSelectedRoom(roomId);
    });

    window.tandim?.onDeepLinkJoin((data) => {
      void openCallWindow(data.roomId);
    });

    window.tandim?.onDeepLinkWorkspace((data) => {
      console.log("Deep link workspace switch:", data.workspaceId);
    });
  }, [openCallWindow]);

  const handleRefreshRooms = useCallback(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleRoomDeleted = useCallback(
    (deletedRoomName: string) => {
      if (selectedRoom === deletedRoomName) {
        setSelectedRoom(null);
      }
      fetchRooms();
    },
    [selectedRoom, fetchRooms],
  );

  const handleQuickTalkRequest = useCallback((targetUserId: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit("signal:quick-talk-request", {
      workspaceId: WORKSPACE_ID,
      targetUserId,
    });

    socket.once("signal:quick-talk-created", (data: { roomId: string }) => {
      // Room created, waiting for target to accept/decline
    });
  }, [socketRef]);

  const handleQuickTalkAccept = useCallback((roomId: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit("signal:quick-talk-accept", { roomId });
    setIncomingQuickTalk(null);
    openCallWindow(roomId);
  }, [socketRef, openCallWindow]);

  const handleQuickTalkDecline = useCallback((roomId: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit("signal:quick-talk-decline", { roomId });
    setIncomingQuickTalk(null);
  }, [socketRef]);

  const selectedRoomObj = rooms.find((r) => r.name === selectedRoom) ?? null;

  return (
    <ThemeProvider>
      <TooltipProvider>
        <SidebarProvider>
          <LobbySidebar
            rooms={rooms}
            selectedRoom={selectedRoom}
            onSelectRoom={setSelectedRoom}
            roomOccupancy={mergedOccupancy}
            onRefreshRooms={handleRefreshRooms}
          />
          <SidebarInset>
            <LobbyHeader
              title={selectedRoom ?? "Tandim"}
              dndActive={dndActive}
              onToggleDnd={toggleDnd}
              onOpenSettings={() => setSettingsOpen(true)}
              onLogout={onLogout}
            />
            <UpdateBanner />
            {!serverReachable && (
              <div className="flex items-center gap-2 border-b border-red-900/50 bg-red-950/50 px-4 py-2 text-xs text-red-400">
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
                Server unreachable — retrying...
              </div>
            )}
            {joinError && (
              <div className="flex items-center justify-between border-b border-amber-900/50 bg-amber-950/50 px-4 py-2 text-xs text-amber-400">
                <span>{joinError}</span>
                <button
                  onClick={() => setJoinError(null)}
                  className="ml-2 text-amber-500 hover:text-amber-300"
                >
                  Dismiss
                </button>
              </div>
            )}
            <div className="flex flex-1 overflow-hidden">
              <LobbyContent
                displayName={profile.displayName}
                userId={authUserId}
                users={users}
                onQuickTalk={handleQuickTalkRequest}
              />
              {selectedRoom && (
                <LobbyRightSidebar
                  room={selectedRoomObj}
                  participants={participants}
                  onJoin={({ audioEnabled }) => void joinRoom(audioEnabled)}
                  onClose={() => setSelectedRoom(null)}
                  onRefreshRooms={handleRefreshRooms}
                />
              )}
            </div>
          </SidebarInset>
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            profile={profile}
            onSave={updateProfile}
          />
          {incomingQuickTalk && (
            <QuickTalkNotification
              roomId={incomingQuickTalk.roomId}
              fromDisplayName={incomingQuickTalk.fromDisplayName}
              onAccept={handleQuickTalkAccept}
              onDecline={handleQuickTalkDecline}
            />
          )}
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
