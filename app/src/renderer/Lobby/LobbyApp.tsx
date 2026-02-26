import React, { useCallback, useEffect, useState } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { LobbySidebar } from "@/renderer/Lobby/LobbySidebar";
import { LobbyHeader } from "@/renderer/Lobby/LobbyHeader";
import { LobbyContent } from "@/renderer/Lobby/LobbyContent";
import { LobbyRightSidebar } from "@/renderer/Lobby/LobbyRightSidebar";
import type { CallSession } from "@/renderer/types";
import { ROOMS } from "@/renderer/types";

const API_URL = "http://localhost:3000";
const WORKSPACE_ID = "team-local";
const DISPLAY_NAME = "Jrod";

type RoomParticipant = { userId: string; displayName: string };

export function LobbyApp() {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [roomOccupancy, setRoomOccupancy] = useState<Map<string, number>>(new Map());
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [serverReachable, setServerReachable] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Auto-dismiss join error after 5 seconds
  useEffect(() => {
    if (!joinError) return;
    const timeout = setTimeout(() => setJoinError(null), 5000);
    return () => clearTimeout(timeout);
  }, [joinError]);

  // Poll room occupancy
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
        userId: `u-${Math.random().toString(36).slice(2, 8)}`,
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
            roomOccupancy={roomOccupancy}
          />
          <SidebarInset>
            <LobbyHeader title={selectedRoom ?? "Tandim"} />
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
              <LobbyContent displayName={DISPLAY_NAME} />
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
