import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { z } from "zod";
import { RoomStateStore, CROSSTALK_INVITE_TTL_MS } from "./roomState";
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
  targetUserIds: z.array(z.string().min(1)).min(1)
});

const crosstalkEndSchema = z.object({
  crosstalkId: z.string().min(1)
});

const crosstalkInviteSchema = z.object({
  workspaceId: z.string().min(1),
  roomId: z.string().min(1),
  targetUserIds: z.array(z.string().min(1)).min(1)
});

const crosstalkInviteResponseSchema = z.object({
  workspaceId: z.string().min(1),
  roomId: z.string().min(1),
  invitationId: z.string().min(1)
});

const presenceConnectSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  workspaceId: z.string().min(1)
});

const presenceStatusSchema = z.object({
  status: z.enum(["available", "idle", "dnd"])
});

const quickTalkRequestSchema = z.object({
  workspaceId: z.string().min(1),
  targetUserId: z.string().min(1)
});

const quickTalkAcceptSchema = z.object({
  roomId: z.string().min(1)
});

const quickTalkDeclineSchema = z.object({
  roomId: z.string().min(1)
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

  // roomId -> { initiatorUserId, targetUserId, workspaceId, initiatorSocketId }
  const pendingQuickTalks = new Map<string, {
    initiatorUserId: string;
    targetUserId: string;
    workspaceId: string;
    initiatorSocketId: string;
    initiatorDisplayName: string;
  }>();

  // Periodically expire stale crosstalk invitations
  const expirationInterval = setInterval(() => {
    const expired = rooms.expireCrosstalkInvitations();
    for (const { roomKey, invitation } of expired) {
      const participantUserIds = [invitation.inviterUserId, ...invitation.inviteeUserIds];
      for (const userId of participantUserIds) {
        const socketId = rooms.getPeerSocket(roomKey.workspaceId, roomKey.roomId, userId);
        if (socketId) {
          io.to(socketId).emit("signal:crosstalk-invite-expired", {
            invitationId: invitation.invitationId
          });
        }
      }
    }
  }, 5_000);

  io.on("close", () => {
    clearInterval(expirationInterval);
  });

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

      socket.join(`presence:${workspaceId}`);
      socket.emit("presence:snapshot", presence.getAll(workspaceId));
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

      const crosstalks = rooms.getCrosstalks(workspaceId, roomId);
      socket.emit("signal:joined", {
        workspaceId,
        roomId,
        peers: joined.roomPeers.map((peer) => ({ userId: peer.userId, displayName: peer.displayName })),
        activeScreenSharerUserId: joined.activeScreenSharerUserId,
        crosstalks
      });

      socket.to(getChannel(workspaceId, roomId)).emit("signal:peer-joined", { userId, displayName });

      // Update presence to in-call
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
          code: "invalid_crosstalk_payload",
          message: "Crosstalk start payload is invalid",
          retryable: false
        });
        return;
      }

      const result = rooms.startCrosstalk(socket.id, parsed.data.targetUserIds);
      if (!result.ok) {
        socket.emit("signal:error", {
          code: result.reason,
          message: "Unable to start crosstalk",
          retryable: result.reason !== "not_in_room"
        });
        return;
      }

      const channel = getChannel(result.roomKey.workspaceId, result.roomKey.roomId);

      for (const endedId of result.autoLeftCrosstalkIds) {
        io.to(channel).emit("signal:crosstalk-ended", { crosstalkId: endedId });
      }

      io.to(channel).emit("signal:crosstalk-started", {
        crosstalk: result.crosstalk
      });
    });

    socket.on("signal:crosstalk-end", (input: unknown) => {
      const parsed = crosstalkEndSchema.safeParse(input);
      if (!parsed.success) {
        socket.emit("signal:error", {
          code: "invalid_crosstalk_payload",
          message: "Crosstalk end payload is invalid",
          retryable: false
        });
        return;
      }

      const result = rooms.endCrosstalk(socket.id, parsed.data.crosstalkId);
      if (!result.ok) {
        socket.emit("signal:error", {
          code: result.reason,
          message: "Unable to end crosstalk",
          retryable: false
        });
        return;
      }

      io.to(getChannel(result.roomKey.workspaceId, result.roomKey.roomId)).emit(
        "signal:crosstalk-ended",
        { crosstalkId: parsed.data.crosstalkId }
      );
    });

    socket.on("signal:crosstalk-invite", (input: unknown) => {
      const parsed = crosstalkInviteSchema.safeParse(input);
      if (!parsed.success) {
        socket.emit("signal:error", {
          code: "invalid_crosstalk_invite_payload",
          message: "Crosstalk invite payload is invalid",
          retryable: false
        });
        return;
      }

      const membership = rooms.getMembershipBySocket(socket.id);
      if (!membership) {
        socket.emit("signal:error", {
          code: "not_in_room",
          message: "You must be in a room to invite",
          retryable: false
        });
        return;
      }

      const { workspaceId, roomId, targetUserIds } = parsed.data;
      if (membership.workspaceId !== workspaceId || membership.roomId !== roomId) {
        socket.emit("signal:error", {
          code: "room_mismatch",
          message: "You are not in the specified room",
          retryable: false
        });
        return;
      }

      const result = rooms.createCrosstalkInvitation(
        workspaceId,
        roomId,
        membership.userId,
        targetUserIds
      );

      if (!result.ok) {
        socket.emit("signal:error", {
          code: result.reason,
          message: "Unable to create crosstalk invitation",
          retryable: false
        });
        return;
      }

      for (const inviteeId of result.invitation.inviteeUserIds) {
        const inviteeSocketId = rooms.getPeerSocket(workspaceId, roomId, inviteeId);
        if (inviteeSocketId) {
          io.to(inviteeSocketId).emit("signal:crosstalk-invited", {
            invitationId: result.invitation.invitationId,
            inviterUserId: result.invitation.inviterUserId,
            inviterDisplayName: result.invitation.inviterDisplayName,
            roomId
          });
        }
      }

      socket.emit("signal:crosstalk-invite-sent", {
        invitationId: result.invitation.invitationId,
        targetUserIds
      });
    });

    socket.on("signal:crosstalk-invite-accept", (input: unknown) => {
      const parsed = crosstalkInviteResponseSchema.safeParse(input);
      if (!parsed.success) {
        socket.emit("signal:error", {
          code: "invalid_crosstalk_accept_payload",
          message: "Crosstalk accept payload is invalid",
          retryable: false
        });
        return;
      }

      const membership = rooms.getMembershipBySocket(socket.id);
      if (!membership) {
        socket.emit("signal:error", {
          code: "not_in_room",
          message: "You must be in a room to accept",
          retryable: false
        });
        return;
      }

      const { workspaceId, roomId, invitationId } = parsed.data;
      const result = rooms.acceptCrosstalkInvitation(
        workspaceId,
        roomId,
        invitationId,
        membership.userId
      );

      if (!result.ok) {
        socket.emit("signal:error", {
          code: result.reason,
          message: "Unable to accept crosstalk invitation",
          retryable: false
        });
        return;
      }

      const inviterSocketId = rooms.getPeerSocket(workspaceId, roomId, result.invitation.inviterUserId);
      if (inviterSocketId) {
        io.to(inviterSocketId).emit("signal:crosstalk-invite-accepted", {
          invitationId,
          userId: membership.userId
        });
      }

      if (result.allAccepted) {
        const participantUserIds = [
          result.invitation.inviterUserId,
          ...result.invitation.inviteeUserIds
        ];
        for (const userId of participantUserIds) {
          const targetSocketId = rooms.getPeerSocket(workspaceId, roomId, userId);
          if (targetSocketId) {
            io.to(targetSocketId).emit("signal:crosstalk-started", {
              invitationId,
              participantUserIds
            });
          }
        }
      }
    });

    socket.on("signal:crosstalk-invite-decline", (input: unknown) => {
      const parsed = crosstalkInviteResponseSchema.safeParse(input);
      if (!parsed.success) {
        socket.emit("signal:error", {
          code: "invalid_crosstalk_decline_payload",
          message: "Crosstalk decline payload is invalid",
          retryable: false
        });
        return;
      }

      const membership = rooms.getMembershipBySocket(socket.id);
      if (!membership) {
        socket.emit("signal:error", {
          code: "not_in_room",
          message: "You must be in a room to decline",
          retryable: false
        });
        return;
      }

      const { workspaceId, roomId, invitationId } = parsed.data;
      const result = rooms.declineCrosstalkInvitation(
        workspaceId,
        roomId,
        invitationId,
        membership.userId
      );

      if (!result.ok) {
        socket.emit("signal:error", {
          code: result.reason,
          message: "Unable to decline crosstalk invitation",
          retryable: false
        });
        return;
      }

      const inviterSocketId = rooms.getPeerSocket(workspaceId, roomId, result.invitation.inviterUserId);
      if (inviterSocketId) {
        io.to(inviterSocketId).emit("signal:crosstalk-invite-declined", {
          invitationId,
          userId: membership.userId
        });
      }
    });

    // --- Quick talk events ---

    socket.on("signal:quick-talk-request", (input: unknown) => {
      const parsed = quickTalkRequestSchema.safeParse(input);
      if (!parsed.success) {
        socket.emit("signal:error", {
          code: "invalid_quick_talk_payload",
          message: "Quick talk request payload is invalid",
          retryable: false
        });
        return;
      }

      const { workspaceId, targetUserId } = parsed.data;

      // Find the requester's presence to get their userId and displayName
      const requesterPresence = presence.getBySocket(socket.id);
      if (!requesterPresence) {
        socket.emit("signal:error", {
          code: "not_connected",
          message: "Must be connected to presence before requesting quick talk",
          retryable: false
        });
        return;
      }

      // Find the target user's presence socket
      const targetPresence = presence.findByUserId(workspaceId, targetUserId);
      if (!targetPresence) {
        socket.emit("signal:error", {
          code: "target_not_found",
          message: "Target user is not online",
          retryable: false
        });
        return;
      }

      if (targetPresence.status === "dnd") {
        socket.emit("signal:error", {
          code: "target_dnd",
          message: "Target user is in Do Not Disturb mode",
          retryable: false
        });
        return;
      }

      // Create a temporary quick talk room
      const roomId = rooms.createQuickTalkRoom(workspaceId, requesterPresence.userId, targetUserId);

      // Track the pending quick talk
      pendingQuickTalks.set(roomId, {
        initiatorUserId: requesterPresence.userId,
        targetUserId,
        workspaceId,
        initiatorSocketId: socket.id,
        initiatorDisplayName: requesterPresence.displayName
      });

      // Notify the requester with the room ID
      socket.emit("signal:quick-talk-created", {
        roomId,
        targetUserId
      });

      // Notify the target user
      io.to(targetPresence.socketId).emit("signal:quick-talk-incoming", {
        roomId,
        fromUserId: requesterPresence.userId,
        fromDisplayName: requesterPresence.displayName,
        workspaceId
      });
    });

    socket.on("signal:quick-talk-accept", (input: unknown) => {
      const parsed = quickTalkAcceptSchema.safeParse(input);
      if (!parsed.success) {
        socket.emit("signal:error", {
          code: "invalid_quick_talk_payload",
          message: "Quick talk accept payload is invalid",
          retryable: false
        });
        return;
      }

      const { roomId } = parsed.data;
      const pending = pendingQuickTalks.get(roomId);
      if (!pending) {
        socket.emit("signal:error", {
          code: "quick_talk_not_found",
          message: "Quick talk request not found or already expired",
          retryable: false
        });
        return;
      }

      // Notify the initiator that the call was accepted
      io.to(pending.initiatorSocketId).emit("signal:quick-talk-accepted", {
        roomId,
        targetUserId: pending.targetUserId
      });

      // Clean up pending state
      pendingQuickTalks.delete(roomId);
    });

    socket.on("signal:quick-talk-decline", (input: unknown) => {
      const parsed = quickTalkDeclineSchema.safeParse(input);
      if (!parsed.success) {
        socket.emit("signal:error", {
          code: "invalid_quick_talk_payload",
          message: "Quick talk decline payload is invalid",
          retryable: false
        });
        return;
      }

      const { roomId } = parsed.data;
      const pending = pendingQuickTalks.get(roomId);
      if (!pending) {
        socket.emit("signal:error", {
          code: "quick_talk_not_found",
          message: "Quick talk request not found or already expired",
          retryable: false
        });
        return;
      }

      // Notify the initiator that the call was declined
      io.to(pending.initiatorSocketId).emit("signal:quick-talk-declined", {
        roomId,
        targetUserId: pending.targetUserId
      });

      // Clean up pending state
      pendingQuickTalks.delete(roomId);
    });

    socket.on("disconnect", () => {
      // Handle room leave
      const result = rooms.leaveBySocket(socket.id);
      if (result) {
        const channel = getChannel(result.roomKey.workspaceId, result.roomKey.roomId);

        // Notify about crosstalks ended due to disconnect
        for (const crosstalkId of result.removedCrosstalkIds) {
          io.to(channel).emit("signal:crosstalk-ended", { crosstalkId });
        }

        io.to(channel).emit("signal:peer-left", {
          userId: result.userId,
          activeScreenSharerUserId: result.activeScreenSharerUserId
        });

        // Clear in-call presence for the user's lobby socket
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

      // Clean up any pending quick talks initiated by this socket
      for (const [roomId, pending] of pendingQuickTalks) {
        if (pending.initiatorSocketId === socket.id) {
          const targetPresence = presence.findByUserId(pending.workspaceId, pending.targetUserId);
          if (targetPresence) {
            io.to(targetPresence.socketId).emit("signal:quick-talk-cancelled", { roomId });
          }
          pendingQuickTalks.delete(roomId);
        }
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
