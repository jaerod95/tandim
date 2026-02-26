import React, { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

export type PresenceStatus = "available" | "in-call" | "idle" | "dnd" | "offline";

export type UserPresence = {
  userId: string;
  displayName: string;
  status: PresenceStatus;
  currentRoom?: { workspaceId: string; roomId: string };
  lastSeen: number;
  socketId: string;
  workspaceId: string;
};

type UsePresenceOptions = {
  apiUrl: string;
  workspaceId: string;
  userId: string;
  displayName: string;
  token?: string;
};

type UsePresenceReturn = {
  users: UserPresence[];
  connected: boolean;
  setStatus: (status: "available" | "idle" | "dnd") => void;
  socketRef: React.RefObject<Socket | null>;
};

export function usePresence(options: UsePresenceOptions): UsePresenceReturn {
  const { apiUrl, workspaceId, userId, displayName, token } = options;
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const setStatus = useCallback((status: "available" | "idle" | "dnd") => {
    socketRef.current?.emit("presence:status-change", { status });
  }, []);

  useEffect(() => {
    const socket = io(apiUrl, {
      path: "/api/signal",
      transports: ["websocket"],
      auth: token ? { token } : undefined,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("presence:connect", {
        userId,
        displayName,
        workspaceId,
      });
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    // Full snapshot of all users in the workspace
    socket.on("presence:snapshot", (snapshot: UserPresence[]) => {
      setUsers(snapshot);
    });

    socket.on("presence:user-online", (user: UserPresence) => {
      setUsers((prev) => {
        // Replace if same userId already exists (reconnect), otherwise add
        const filtered = prev.filter((u) => u.userId !== user.userId);
        return [...filtered, user];
      });
    });

    socket.on("presence:user-offline", (data: { userId: string }) => {
      setUsers((prev) => prev.filter((u) => u.userId !== data.userId));
    });

    socket.on("presence:user-updated", (user: UserPresence) => {
      setUsers((prev) =>
        prev.map((u) => (u.userId === user.userId ? user : u)),
      );
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [apiUrl, workspaceId, userId, displayName, token]);

  return { users, connected, setStatus, socketRef };
}
