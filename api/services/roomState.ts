import { randomUUID } from "crypto";

export type Peer = {
  userId: string;
  displayName: string;
  socketId: string;
  joinedAt: number;
  lastHeartbeatAt: number;
};

export type RoomKey = {
  workspaceId: string;
  roomId: string;
};

export type Crosstalk = {
  id: string;
  initiatorUserId: string;
  participantUserIds: Set<string>;
};

export type CrosstalkInfo = {
  id: string;
  initiatorUserId: string;
  participantUserIds: string[];
};

export type CrosstalkInvitation = {
  invitationId: string;
  inviterUserId: string;
  inviterDisplayName: string;
  inviteeUserIds: string[];
  acceptedUserIds: Set<string>;
  declinedUserIds: Set<string>;
  createdAt: number;
};

type RoomState = {
  peersByUserId: Map<string, Peer>;
  activeScreenSharerUserId: string | null;
  crosstalks: Map<string, Crosstalk>;
  crosstalkInvitations: Map<string, CrosstalkInvitation>;
};

export type JoinPeerInput = {
  workspaceId: string;
  roomId: string;
  userId: string;
  displayName: string;
  socketId: string;
  nowMs?: number;
};

let crosstalkCounter = 0;

export const CROSSTALK_INVITE_TTL_MS = 30_000;

export class RoomStateStore {
  private readonly rooms = new Map<string, RoomState>();
  private readonly socketToRoomAndUser = new Map<
    string,
    { roomKey: string; workspaceId: string; roomId: string; userId: string }
  >();

  joinPeer(input: JoinPeerInput): { roomPeers: Peer[]; activeScreenSharerUserId: string | null } {
    const now = input.nowMs ?? Date.now();
    const roomKey = this.toRoomKey(input.workspaceId, input.roomId);
    const room = this.ensureRoom(roomKey);

    room.peersByUserId.set(input.userId, {
      userId: input.userId,
      displayName: input.displayName,
      socketId: input.socketId,
      joinedAt: now,
      lastHeartbeatAt: now
    });

    this.socketToRoomAndUser.set(input.socketId, {
      roomKey,
      workspaceId: input.workspaceId,
      roomId: input.roomId,
      userId: input.userId
    });

    return {
      roomPeers: Array.from(room.peersByUserId.values()),
      activeScreenSharerUserId: room.activeScreenSharerUserId
    };
  }

  leaveBySocket(socketId: string): { roomKey: RoomKey; userId: string; activeScreenSharerUserId: string | null; removedCrosstalkIds: string[] } | null {
    const membership = this.socketToRoomAndUser.get(socketId);
    if (!membership) {
      return null;
    }

    const room = this.rooms.get(membership.roomKey);
    if (!room) {
      this.socketToRoomAndUser.delete(socketId);
      return null;
    }

    room.peersByUserId.delete(membership.userId);
    if (room.activeScreenSharerUserId === membership.userId) {
      room.activeScreenSharerUserId = null;
    }

    // Clean up crosstalks this user was in
    const removedCrosstalkIds = this.removeUserFromCrosstalks(room, membership.userId);

    this.socketToRoomAndUser.delete(socketId);

    if (room.peersByUserId.size === 0) {
      this.rooms.delete(membership.roomKey);
    }

    return {
      roomKey: { workspaceId: membership.workspaceId, roomId: membership.roomId },
      userId: membership.userId,
      activeScreenSharerUserId: room.activeScreenSharerUserId,
      removedCrosstalkIds
    };
  }

  updateHeartbeat(socketId: string, nowMs?: number): boolean {
    const membership = this.socketToRoomAndUser.get(socketId);
    if (!membership) {
      return false;
    }
    const room = this.rooms.get(membership.roomKey);
    const peer = room?.peersByUserId.get(membership.userId);
    if (!peer) {
      return false;
    }
    peer.lastHeartbeatAt = nowMs ?? Date.now();
    return true;
  }

  startScreenShare(socketId: string): { ok: true; roomKey: RoomKey; userId: string } | { ok: false; reason: string } {
    const membership = this.socketToRoomAndUser.get(socketId);
    if (!membership) {
      return { ok: false, reason: "not_in_room" };
    }

    const room = this.rooms.get(membership.roomKey);
    if (!room) {
      return { ok: false, reason: "room_not_found" };
    }

    if (room.activeScreenSharerUserId && room.activeScreenSharerUserId !== membership.userId) {
      return { ok: false, reason: "screen_share_already_active" };
    }

    room.activeScreenSharerUserId = membership.userId;
    return {
      ok: true,
      roomKey: { workspaceId: membership.workspaceId, roomId: membership.roomId },
      userId: membership.userId
    };
  }

  stopScreenShare(socketId: string): { ok: true; roomKey: RoomKey; activeScreenSharerUserId: string | null } | { ok: false; reason: string } {
    const membership = this.socketToRoomAndUser.get(socketId);
    if (!membership) {
      return { ok: false, reason: "not_in_room" };
    }

    const room = this.rooms.get(membership.roomKey);
    if (!room) {
      return { ok: false, reason: "room_not_found" };
    }

    if (room.activeScreenSharerUserId !== membership.userId) {
      return { ok: false, reason: "not_active_screen_sharer" };
    }

    room.activeScreenSharerUserId = null;
    return {
      ok: true,
      roomKey: { workspaceId: membership.workspaceId, roomId: membership.roomId },
      activeScreenSharerUserId: room.activeScreenSharerUserId
    };
  }

  getPeerSocket(workspaceId: string, roomId: string, userId: string): string | null {
    const room = this.rooms.get(this.toRoomKey(workspaceId, roomId));
    return room?.peersByUserId.get(userId)?.socketId ?? null;
  }

  getMembershipBySocket(
    socketId: string
  ): { workspaceId: string; roomId: string; userId: string } | null {
    const membership = this.socketToRoomAndUser.get(socketId);
    if (!membership) {
      return null;
    }
    return {
      workspaceId: membership.workspaceId,
      roomId: membership.roomId,
      userId: membership.userId
    };
  }

  getRoomPeerCount(workspaceId: string, roomId: string): number {
    const room = this.rooms.get(this.toRoomKey(workspaceId, roomId));
    return room ? room.peersByUserId.size : 0;
  }

  pruneInactivePeers(maxInactivityMs: number, nowMs?: number): Array<{ roomKey: RoomKey; userId: string; removedCrosstalkIds: string[] }> {
    const now = nowMs ?? Date.now();
    const removed: Array<{ roomKey: RoomKey; userId: string; removedCrosstalkIds: string[] }> = [];

    for (const [key, room] of this.rooms.entries()) {
      const [workspaceId, roomId] = key.split(":");
      for (const peer of room.peersByUserId.values()) {
        if (now - peer.lastHeartbeatAt <= maxInactivityMs) {
          continue;
        }
        room.peersByUserId.delete(peer.userId);
        this.socketToRoomAndUser.delete(peer.socketId);
        if (room.activeScreenSharerUserId === peer.userId) {
          room.activeScreenSharerUserId = null;
        }
        const removedCrosstalkIds = this.removeUserFromCrosstalks(room, peer.userId);
        removed.push({ roomKey: { workspaceId, roomId }, userId: peer.userId, removedCrosstalkIds });
      }

      if (room.peersByUserId.size === 0) {
        this.rooms.delete(key);
      }
    }

    return removed;
  }

  startCrosstalk(
    socketId: string,
    targetUserIds: string[]
  ): { ok: true; roomKey: RoomKey; crosstalk: CrosstalkInfo; autoLeftCrosstalkIds: string[] } | { ok: false; reason: string } {
    const membership = this.socketToRoomAndUser.get(socketId);
    if (!membership) {
      return { ok: false, reason: "not_in_room" };
    }

    const room = this.rooms.get(membership.roomKey);
    if (!room) {
      return { ok: false, reason: "room_not_found" };
    }

    // Validate all targets are in the room
    for (const targetId of targetUserIds) {
      if (!room.peersByUserId.has(targetId)) {
        return { ok: false, reason: "target_not_in_room" };
      }
    }

    if (targetUserIds.includes(membership.userId)) {
      return { ok: false, reason: "cannot_crosstalk_self" };
    }

    // Auto-leave existing crosstalks for the initiator and all targets
    const autoLeftCrosstalkIds: string[] = [];
    const allParticipants = [membership.userId, ...targetUserIds];
    for (const userId of allParticipants) {
      const removed = this.removeUserFromCrosstalks(room, userId);
      for (const id of removed) {
        if (!autoLeftCrosstalkIds.includes(id)) {
          autoLeftCrosstalkIds.push(id);
        }
      }
    }

    const crosstalkId = `ct_${Date.now()}_${++crosstalkCounter}_${Math.random().toString(36).slice(2, 8)}`;
    const participantUserIds = new Set([membership.userId, ...targetUserIds]);
    const crosstalk: Crosstalk = {
      id: crosstalkId,
      initiatorUserId: membership.userId,
      participantUserIds
    };
    room.crosstalks.set(crosstalkId, crosstalk);

    return {
      ok: true,
      roomKey: { workspaceId: membership.workspaceId, roomId: membership.roomId },
      crosstalk: {
        id: crosstalkId,
        initiatorUserId: membership.userId,
        participantUserIds: Array.from(participantUserIds)
      },
      autoLeftCrosstalkIds
    };
  }

  endCrosstalk(
    socketId: string,
    crosstalkId: string
  ): { ok: true; roomKey: RoomKey } | { ok: false; reason: string } {
    const membership = this.socketToRoomAndUser.get(socketId);
    if (!membership) {
      return { ok: false, reason: "not_in_room" };
    }

    const room = this.rooms.get(membership.roomKey);
    if (!room) {
      return { ok: false, reason: "room_not_found" };
    }

    const crosstalk = room.crosstalks.get(crosstalkId);
    if (!crosstalk) {
      return { ok: false, reason: "crosstalk_not_found" };
    }

    if (!crosstalk.participantUserIds.has(membership.userId)) {
      return { ok: false, reason: "not_in_crosstalk" };
    }

    room.crosstalks.delete(crosstalkId);
    return {
      ok: true,
      roomKey: { workspaceId: membership.workspaceId, roomId: membership.roomId }
    };
  }

  getCrosstalks(workspaceId: string, roomId: string): CrosstalkInfo[] {
    const room = this.rooms.get(this.toRoomKey(workspaceId, roomId));
    if (!room) {
      return [];
    }
    return Array.from(room.crosstalks.values()).map((ct) => ({
      id: ct.id,
      initiatorUserId: ct.initiatorUserId,
      participantUserIds: Array.from(ct.participantUserIds)
    }));
  }

  createCrosstalkInvitation(
    workspaceId: string,
    roomId: string,
    inviterUserId: string,
    inviteeUserIds: string[],
    nowMs?: number
  ):
    | { ok: true; invitation: CrosstalkInvitation; roomKey: RoomKey }
    | { ok: false; reason: string } {
    const roomKey = this.toRoomKey(workspaceId, roomId);
    const room = this.rooms.get(roomKey);
    if (!room) {
      return { ok: false, reason: "room_not_found" };
    }

    if (!room.peersByUserId.has(inviterUserId)) {
      return { ok: false, reason: "inviter_not_in_room" };
    }

    for (const inviteeId of inviteeUserIds) {
      if (!room.peersByUserId.has(inviteeId)) {
        return { ok: false, reason: "invitee_not_in_room" };
      }
    }

    const inviter = room.peersByUserId.get(inviterUserId)!;
    const invitation: CrosstalkInvitation = {
      invitationId: randomUUID(),
      inviterUserId,
      inviterDisplayName: inviter.displayName,
      inviteeUserIds: [...inviteeUserIds],
      acceptedUserIds: new Set(),
      declinedUserIds: new Set(),
      createdAt: nowMs ?? Date.now()
    };

    room.crosstalkInvitations.set(invitation.invitationId, invitation);

    return {
      ok: true,
      invitation,
      roomKey: { workspaceId, roomId }
    };
  }

  acceptCrosstalkInvitation(
    workspaceId: string,
    roomId: string,
    invitationId: string,
    userId: string
  ):
    | { ok: true; invitation: CrosstalkInvitation; allAccepted: boolean; roomKey: RoomKey }
    | { ok: false; reason: string } {
    const roomKey = this.toRoomKey(workspaceId, roomId);
    const room = this.rooms.get(roomKey);
    if (!room) {
      return { ok: false, reason: "room_not_found" };
    }

    const invitation = room.crosstalkInvitations.get(invitationId);
    if (!invitation) {
      return { ok: false, reason: "invitation_not_found" };
    }

    if (!invitation.inviteeUserIds.includes(userId)) {
      return { ok: false, reason: "not_invited" };
    }

    invitation.acceptedUserIds.add(userId);

    const allAccepted = invitation.inviteeUserIds.every((id) =>
      invitation.acceptedUserIds.has(id)
    );

    if (allAccepted) {
      room.crosstalkInvitations.delete(invitationId);
    }

    return {
      ok: true,
      invitation,
      allAccepted,
      roomKey: { workspaceId, roomId }
    };
  }

  declineCrosstalkInvitation(
    workspaceId: string,
    roomId: string,
    invitationId: string,
    userId: string
  ):
    | { ok: true; invitation: CrosstalkInvitation; roomKey: RoomKey }
    | { ok: false; reason: string } {
    const roomKey = this.toRoomKey(workspaceId, roomId);
    const room = this.rooms.get(roomKey);
    if (!room) {
      return { ok: false, reason: "room_not_found" };
    }

    const invitation = room.crosstalkInvitations.get(invitationId);
    if (!invitation) {
      return { ok: false, reason: "invitation_not_found" };
    }

    if (!invitation.inviteeUserIds.includes(userId)) {
      return { ok: false, reason: "not_invited" };
    }

    invitation.declinedUserIds.add(userId);
    invitation.inviteeUserIds = invitation.inviteeUserIds.filter((id) => id !== userId);

    if (invitation.inviteeUserIds.length === 0) {
      room.crosstalkInvitations.delete(invitationId);
    }

    return {
      ok: true,
      invitation,
      roomKey: { workspaceId, roomId }
    };
  }

  expireCrosstalkInvitations(nowMs?: number): Array<{
    roomKey: RoomKey;
    invitation: CrosstalkInvitation;
  }> {
    const now = nowMs ?? Date.now();
    const expired: Array<{ roomKey: RoomKey; invitation: CrosstalkInvitation }> = [];

    for (const [key, room] of this.rooms.entries()) {
      const [workspaceId, roomId] = key.split(":");
      for (const [invitationId, invitation] of room.crosstalkInvitations.entries()) {
        if (now - invitation.createdAt >= CROSSTALK_INVITE_TTL_MS) {
          room.crosstalkInvitations.delete(invitationId);
          expired.push({
            roomKey: { workspaceId, roomId },
            invitation
          });
        }
      }
    }

    return expired;
  }

  getCrosstalkInvitation(
    workspaceId: string,
    roomId: string,
    invitationId: string
  ): CrosstalkInvitation | null {
    const room = this.rooms.get(this.toRoomKey(workspaceId, roomId));
    return room?.crosstalkInvitations.get(invitationId) ?? null;
  }

  private removeUserFromCrosstalks(room: RoomState, userId: string): string[] {
    const removedIds: string[] = [];
    for (const [id, ct] of room.crosstalks) {
      if (!ct.participantUserIds.has(userId)) continue;
      ct.participantUserIds.delete(userId);
      // Remove the crosstalk if fewer than 2 participants remain
      if (ct.participantUserIds.size < 2) {
        room.crosstalks.delete(id);
        removedIds.push(id);
      }
    }
    return removedIds;
  }

  private ensureRoom(roomKey: string): RoomState {
    const existing = this.rooms.get(roomKey);
    if (existing) {
      return existing;
    }

    const created: RoomState = {
      peersByUserId: new Map<string, Peer>(),
      activeScreenSharerUserId: null,
      crosstalks: new Map<string, Crosstalk>(),
      crosstalkInvitations: new Map<string, CrosstalkInvitation>()
    };
    this.rooms.set(roomKey, created);
    return created;
  }

  private toRoomKey(workspaceId: string, roomId: string): string {
    return `${workspaceId}:${roomId}`;
  }

  // Introspection methods for debugging
  getAllRooms(): Array<{ workspaceId: string; roomId: string; peerCount: number }> {
    return Array.from(this.rooms.entries()).map(([key, room]) => {
      const [workspaceId, roomId] = key.split(":");
      return {
        workspaceId,
        roomId,
        peerCount: room.peersByUserId.size,
      };
    });
  }

  getRoomDetails(workspaceId: string, roomId: string): { peers: Peer[]; activeScreenSharerUserId: string | null; crosstalks: CrosstalkInfo[] } | null {
    const room = this.rooms.get(this.toRoomKey(workspaceId, roomId));
    if (!room) {
      return null;
    }
    return {
      peers: Array.from(room.peersByUserId.values()),
      activeScreenSharerUserId: room.activeScreenSharerUserId,
      crosstalks: Array.from(room.crosstalks.values()).map((ct) => ({
        id: ct.id,
        initiatorUserId: ct.initiatorUserId,
        participantUserIds: Array.from(ct.participantUserIds)
      })),
    };
  }
}
