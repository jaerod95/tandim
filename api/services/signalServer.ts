import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { z } from "zod";
import { RoomStateStore } from "./roomState";
import { PresenceStore } from "./presenceStore";

const joinSchema = z.object({
  workspaceId: z.string().min(1),
  roomId: z.string().min(1),
  userId: z.string().min(1),
  displayName: z.string().min(1)
});

const relaySchema = z.object({
  workspaceId: z.string().min(1),
  roomId: z.string().min(1),
  toUserId: z.string().min(1),
  payload: z.unknown()
});

const crosstalkStartSchema = z.object({
  workspaceId: z.string().min(1),
  roomId: z.string().min(1),
  targetUserIds: z.array(z.string().min(1)).min(1)
});

const crosstalkEndSchema = z.object({
  workspaceId: z.string().min(1),
  roomId: z.string().min(1),
  crosstalkId: z.string().min(1)
});

const presenceConnectSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  workspaceId: z.string().min(1)
});

const presenceStatusSchema = z.object({
  status: z.enum(["available", "idle", "dnd"])
});

export function createSignalServer(
  httpServer: HttpServer,
  roomStateStore?: RoomStateStore,
  presenceStore?: PresenceStore
): Server {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
    path: "/api/signal"
  });

  const rooms = roomStateStore ?? new RoomStateStore();
  const presence = presenceStore ?? new PresenceStore();

  io.on("connection", (socket) => {
    // --- Presence events ---

    socket.on("presence:connect", (input: unknown) => {
      const parsed = presenceConnectSchema.safeParse(input);
      if (!parsed.success) {
        socket.emit("signal:error", {
          code: "invalid_presence_payload",
          message: "Presence connect payload is invalid",
          retryable: false
        });
        return;
      }

      const { userId, displayName, workspaceId } = parsed.data;
      const userPresence = presence.setPresence(socket.id, { userId, displayName, workspaceId });

      // Join workspace channel so we can broadcast presence to all workspace members
      socket.join(`presence:${workspaceId}`);

      // Send the full presence list to the connecting client
      socket.emit("presence:snapshot", presence.getAll(workspaceId));

      // Broadcast to others in the workspace
      socket.to(`presence:${workspaceId}`).emit("presence:user-online", userPresence);
    });

    socket.on("presence:status-change", (input: unknown) => {
      const parsed = presenceStatusSchema.safeParse(input);
      if (!parsed.success) return;

      const updated = presence.setStatus(socket.id, parsed.data.status);
      if (updated) {
        io.to(`presence:${updated.workspaceId}`).emit("presence:user-updated", updated);
      }
    });

    // --- Signal events ---

    socket.on("signal:join", (input: unknown) => {
      const parsed = joinSchema.safeParse(input);
      if (!parsed.success) {
        socket.emit("signal:error", {
          code: "invalid_join_payload",
          message: "Join payload is invalid",
          retryable: false
        });
        return;
      }

      const { workspaceId, roomId, userId, displayName } = parsed.data;
      const joined = rooms.joinPeer({
        workspaceId,
        roomId,
        userId,
        displayName,
        socketId: socket.id
      });
      socket.join(getChannel(workspaceId, roomId));

      socket.emit("signal:joined", {
        workspaceId,
        roomId,
        peers: joined.roomPeers.map((peer) => ({ userId: peer.userId, displayName: peer.displayName })),
        activeScreenSharerUserId: joined.activeScreenSharerUserId
      });

      socket.to(getChannel(workspaceId, roomId)).emit("signal:peer-joined", { userId, displayName });

      // Update presence to in-call.
      // The call socket is separate from the lobby socket, so find the
      // user's lobby presence entry by userId.
      const lobbyPresence = presence.findByUserId(workspaceId, userId);
      if (lobbyPresence) {
        presence.setInCall(lobbyPresence.socketId, { workspaceId, roomId });
        io.to(`presence:${workspaceId}`).emit("presence:user-updated", lobbyPresence);
      }
    });

    socket.on("signal:heartbeat", () => {
      rooms.updateHeartbeat(socket.id);
    });

    socket.on("signal:offer", (input: unknown) => relayToPeer(io, socket.id, rooms, "signal:offer", input));
    socket.on("signal:answer", (input: unknown) => relayToPeer(io, socket.id, rooms, "signal:answer", input));
    socket.on("signal:ice-candidate", (input: unknown) =>
      relayToPeer(io, socket.id, rooms, "signal:ice-candidate", input)
    );

    socket.on("signal:screen-share-start", () => {
      const result = rooms.startScreenShare(socket.id);
      if (!result.ok) {
        socket.emit("signal:error", {
          code: result.reason,
          message: "Unable to start screen share",
          retryable: result.reason !== "not_in_room"
        });
        return;
      }
      io.to(getChannel(result.roomKey.workspaceId, result.roomKey.roomId)).emit(
        "signal:screen-share-started",
        { userId: result.userId }
      );
    });

    socket.on("signal:screen-share-stop", () => {
      const result = rooms.stopScreenShare(socket.id);
      if (!result.ok) {
        socket.emit("signal:error", {
          code: result.reason,
          message: "Unable to stop screen share",
          retryable: false
        });
        return;
      }
      io.to(getChannel(result.roomKey.workspaceId, result.roomKey.roomId)).emit(
        "signal:screen-share-stopped",
        { activeScreenSharerUserId: result.activeScreenSharerUserId }
      );
    });

    socket.on("signal:crosstalk-start", (input: unknown) => {
      const parsed = crosstalkStartSchema.safeParse(input);
      if (!parsed.success) {
        socket.emit("signal:error", {
          code: "invalid_crosstalk_start_payload",
          message: "Crosstalk start payload is invalid",
          retryable: false
        });
        return;
      }

      const { workspaceId, roomId, targetUserIds } = parsed.data;
      const membership = rooms.getMembershipBySocket(socket.id);
      if (!membership || membership.workspaceId !== workspaceId || membership.roomId !== roomId) {
        socket.emit("signal:error", {
          code: "not_in_room",
          message: "You are not in this room",
          retryable: false
        });
        return;
      }

      const result = rooms.startCrosstalk(workspaceId, roomId, membership.userId, targetUserIds);
      if (!result.ok) {
        socket.emit("signal:error", {
          code: result.reason,
          message: "Unable to start crosstalk",
          retryable: false
        });
        return;
      }

      const channel = getChannel(workspaceId, roomId);
      io.to(channel).emit("signal:crosstalk-started", {
        crosstalkId: result.crosstalk.id,
        initiatorUserId: result.crosstalk.initiatorUserId,
        participantUserIds: Array.from(result.crosstalk.participantUserIds)
      });
    });

    socket.on("signal:crosstalk-end", (input: unknown) => {
      const parsed = crosstalkEndSchema.safeParse(input);
      if (!parsed.success) {
        socket.emit("signal:error", {
          code: "invalid_crosstalk_end_payload",
          message: "Crosstalk end payload is invalid",
          retryable: false
        });
        return;
      }

      const { workspaceId, roomId, crosstalkId } = parsed.data;
      const membership = rooms.getMembershipBySocket(socket.id);
      if (!membership || membership.workspaceId !== workspaceId || membership.roomId !== roomId) {
        socket.emit("signal:error", {
          code: "not_in_room",
          message: "You are not in this room",
          retryable: false
        });
        return;
      }

      const result = rooms.endCrosstalk(workspaceId, roomId, crosstalkId, membership.userId);
      if (!result.ok) {
        socket.emit("signal:error", {
          code: result.reason,
          message: "Unable to end crosstalk",
          retryable: false
        });
        return;
      }

      const channel = getChannel(workspaceId, roomId);
      io.to(channel).emit("signal:crosstalk-ended", { crosstalkId });
    });

    socket.on("disconnect", () => {
      // Handle room leave
      const result = rooms.leaveBySocket(socket.id);
      if (result) {
        const channel = getChannel(result.roomKey.workspaceId, result.roomKey.roomId);
        io.to(channel).emit("signal:peer-left", {
          userId: result.userId,
          activeScreenSharerUserId: result.activeScreenSharerUserId
        });

        // Clean up any crosstalks this peer was involved in
        for (const crosstalkId of result.endedCrosstalkIds) {
          io.to(channel).emit("signal:crosstalk-ended", { crosstalkId });
        }

        // The call window has its own socket, separate from the lobby socket.
        // Find the user's lobby presence entry and clear their in-call state.
        const lobbyPresence = presence.findByUserId(result.roomKey.workspaceId, result.userId);
        if (lobbyPresence) {
          presence.clearCall(lobbyPresence.socketId);
          io.to(`presence:${lobbyPresence.workspaceId}`).emit("presence:user-updated", lobbyPresence);
        }
      }

      // Handle presence removal (lobby socket disconnecting)
      const removedPresence = presence.removeBySocket(socket.id);
      if (removedPresence) {
        io.to(`presence:${removedPresence.workspaceId}`).emit("presence:user-offline", {
          userId: removedPresence.userId,
          socketId: socket.id
        });
      }
    });
  });

  return io;
}

function relayToPeer(
  io: Server,
  sourceSocketId: string,
  rooms: RoomStateStore,
  eventName: "signal:offer" | "signal:answer" | "signal:ice-candidate",
  input: unknown
): void {
  const parsed = relaySchema.safeParse(input);
  if (!parsed.success) {
    io.to(sourceSocketId).emit("signal:error", {
      code: "invalid_signal_payload",
      message: "Signal payload is invalid",
      retryable: false
    });
    return;
  }

  const payload = parsed.data;
  const sourceMembership = rooms.getMembershipBySocket(sourceSocketId);
  if (!sourceMembership) {
    io.to(sourceSocketId).emit("signal:error", {
      code: "not_in_room",
      message: "Source peer is not in a room",
      retryable: false
    });
    return;
  }

  if (
    sourceMembership.workspaceId !== payload.workspaceId ||
    sourceMembership.roomId !== payload.roomId
  ) {
    io.to(sourceSocketId).emit("signal:error", {
      code: "room_mismatch",
      message: "Source peer does not belong to target room",
      retryable: false
    });
    return;
  }

  const targetSocketId = rooms.getPeerSocket(payload.workspaceId, payload.roomId, payload.toUserId);
  if (!targetSocketId) {
    io.to(sourceSocketId).emit("signal:error", {
      code: "peer_not_found",
      message: "Target peer not found",
      retryable: true
    });
    return;
  }

  io.to(targetSocketId).emit(eventName, {
    workspaceId: payload.workspaceId,
    roomId: payload.roomId,
    fromUserId: sourceMembership.userId,
    payload: payload.payload
  });
}

function getChannel(workspaceId: string, roomId: string): string {
  return `${workspaceId}:${roomId}`;
}
