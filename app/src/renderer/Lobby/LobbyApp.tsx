import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { LobbySidebar } from "@/renderer/Lobby/LobbySidebar";
import { LobbyHeader } from "@/renderer/Lobby/LobbyHeader";
import { LobbyContent } from "@/renderer/Lobby/LobbyContent";
import { LobbyRightSidebar } from "@/renderer/Lobby/LobbyRightSidebar";
import type { CallSession } from "@/renderer/types";
import { ROOMS } from "@/renderer/types";
import { usePresence } from "@/hooks/use-presence";
import { useIdleDetector } from "@/hooks/use-idle-detector";
import { useDnd } from "@/hooks/use-dnd";

const API_URL = "http://localhost:3000";
const WORKSPACE_ID = "team-local";
const DISPLAY_NAME = "Jrod";
const USER_ID = `u-${Math.random().toString(36).slice(2, 8)}`;

type RoomParticipant = { userId: string; displayName: string };

export function LobbyApp() {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [roomOccupancy, setRoomOccupancy] = useState<Map<string, number>>(new Map());
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [serverReachable, setServerReachable] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const { dndActive, toggleDnd } = useDnd();

  // Auto-dismiss join error after 5 seconds
  useEffect(() => {
    if (!joinError) return;
    const timeout = setTimeout(() => setJoinError(null), 5000);
    return () => clearTimeout(timeout);
  }, [joinError]);

  const { users, setStatus } = usePresence({
    apiUrl: API_URL,
    workspaceId: WORKSPACE_ID,
    userId: USER_ID,
    displayName: DISPLAY_NAME,
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

  // Deep link support
  useEffect(() => {
    window.tandim?.getPendingRoom().then((pending) => {
      if (pending) setSelectedRoom(pending);
    });
    window.tandim?.onDeepLinkRoom((roomId) => {
      setSelectedRoom(roomId);
    });
  }, []);

  const joinRoom = useCallback(
    async (audioEnabled: boolean) => {
      if (!selectedRoom) return;

      const payload: CallSession = {
        apiUrl: API_URL,
        workspaceId: WORKSPACE_ID,
        roomId: selectedRoom,
        displayName: DISPLAY_NAME,
        userId: USER_ID,
      };

      try {
        await window.tandim?.openCallWindow(payload);
      } catch (error) {
        console.error("Failed to open call window:", error);
        setJoinError("Failed to open call window. Please try again.");
      }
    },
    [selectedRoom],
  );

  const selectedRoomObj = ROOMS.find((r) => r.name === selectedRoom) ?? null;

  return (
    <ThemeProvider>
      <TooltipProvider>
        <SidebarProvider>
          <LobbySidebar
            selectedRoom={selectedRoom}
            onSelectRoom={setSelectedRoom}
            roomOccupancy={mergedOccupancy}
          />
          <SidebarInset>
            <LobbyHeader
              title={selectedRoom ?? "Tandim"}
              dndActive={dndActive}
              onToggleDnd={toggleDnd}
            />
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
                displayName={DISPLAY_NAME}
                userId={USER_ID}
                users={users}
              />
              {selectedRoom && (
                <LobbyRightSidebar
                  room={selectedRoomObj}
                  participants={participants}
                  onJoin={({ audioEnabled }) => void joinRoom(audioEnabled)}
                  onClose={() => setSelectedRoom(null)}
                />
              )}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
