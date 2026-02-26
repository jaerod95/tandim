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
  createdAt: number;
};

type RoomState = {
  peersByUserId: Map<string, Peer>;
  activeScreenSharerUserId: string | null;
  crosstalks: Map<string, Crosstalk>;
};

export type JoinPeerInput = {
  workspaceId: string;
  roomId: string;
  userId: string;
  displayName: string;
  socketId: string;
  nowMs?: number;
};

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

  leaveBySocket(socketId: string): {
    roomKey: RoomKey;
    userId: string;
    activeScreenSharerUserId: string | null;
    endedCrosstalkIds: string[];
  } | null {
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
    this.socketToRoomAndUser.delete(socketId);

    const endedCrosstalkIds = this.removeUserFromCrosstalks(room, membership.userId);

    if (room.peersByUserId.size === 0) {
      this.rooms.delete(membership.roomKey);
    }

    return {
      roomKey: { workspaceId: membership.workspaceId, roomId: membership.roomId },
      userId: membership.userId,
      activeScreenSharerUserId: room.activeScreenSharerUserId,
      endedCrosstalkIds
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

  pruneInactivePeers(maxInactivityMs: number, nowMs?: number): Array<{ roomKey: RoomKey; userId: string; endedCrosstalkIds: string[] }> {
    const now = nowMs ?? Date.now();
    const removed: Array<{ roomKey: RoomKey; userId: string; endedCrosstalkIds: string[] }> = [];

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
        const endedCrosstalkIds = this.removeUserFromCrosstalks(room, peer.userId);
        removed.push({ roomKey: { workspaceId, roomId }, userId: peer.userId, endedCrosstalkIds });
      }

      if (room.peersByUserId.size === 0) {
        this.rooms.delete(key);
      }
    }

    return removed;
  }

  // ── Crosstalk methods ──────────────────────────────────────────

  private nextCrosstalkId = 0;

  startCrosstalk(
    workspaceId: string,
    roomId: string,
    initiatorUserId: string,
    targetUserIds: string[]
  ): { ok: true; crosstalk: Crosstalk; roomKey: RoomKey } | { ok: false; reason: string } {
    const key = this.toRoomKey(workspaceId, roomId);
    const room = this.rooms.get(key);
    if (!room) {
      return { ok: false, reason: "room_not_found" };
    }

    if (!room.peersByUserId.has(initiatorUserId)) {
      return { ok: false, reason: "initiator_not_in_room" };
    }

    for (const targetId of targetUserIds) {
      if (!room.peersByUserId.has(targetId)) {
        return { ok: false, reason: "target_not_in_room" };
      }
    }

    // Check if initiator or any target is already in a crosstalk
    for (const ct of room.crosstalks.values()) {
      if (ct.participantUserIds.has(initiatorUserId)) {
        return { ok: false, reason: "already_in_crosstalk" };
      }
      for (const targetId of targetUserIds) {
        if (ct.participantUserIds.has(targetId)) {
          return { ok: false, reason: "target_already_in_crosstalk" };
        }
      }
    }

    const crosstalkId = `ct_${++this.nextCrosstalkId}`;
    const participantUserIds = new Set([initiatorUserId, ...targetUserIds]);

    const crosstalk: Crosstalk = {
      id: crosstalkId,
      initiatorUserId,
      participantUserIds,
      createdAt: Date.now()
    };

    room.crosstalks.set(crosstalkId, crosstalk);

    return {
      ok: true,
      crosstalk,
      roomKey: { workspaceId, roomId }
    };
  }

  endCrosstalk(
    workspaceId: string,
    roomId: string,
    crosstalkId: string,
    requestingUserId: string
  ): { ok: true; roomKey: RoomKey } | { ok: false; reason: string } {
    const key = this.toRoomKey(workspaceId, roomId);
    const room = this.rooms.get(key);
    if (!room) {
      return { ok: false, reason: "room_not_found" };
    }

    const crosstalk = room.crosstalks.get(crosstalkId);
    if (!crosstalk) {
      return { ok: false, reason: "crosstalk_not_found" };
    }

    if (!crosstalk.participantUserIds.has(requestingUserId)) {
      return { ok: false, reason: "not_in_crosstalk" };
    }

    room.crosstalks.delete(crosstalkId);
    return { ok: true, roomKey: { workspaceId, roomId } };
  }

  getCrosstalkForUser(workspaceId: string, roomId: string, userId: string): Crosstalk | null {
    const room = this.rooms.get(this.toRoomKey(workspaceId, roomId));
    if (!room) {
      return null;
    }
    for (const ct of room.crosstalks.values()) {
      if (ct.participantUserIds.has(userId)) {
        return ct;
      }
    }
    return null;
  }

  getCrosstalksInRoom(workspaceId: string, roomId: string): Crosstalk[] {
    const room = this.rooms.get(this.toRoomKey(workspaceId, roomId));
    if (!room) {
      return [];
    }
    return Array.from(room.crosstalks.values());
  }

  /**
   * Remove a user from all crosstalks in a room.
   * If a crosstalk drops below 2 participants, it is auto-ended.
   * Returns the IDs of crosstalks that were ended.
   */
  private removeUserFromCrosstalks(room: RoomState, userId: string): string[] {
    const ended: string[] = [];
    for (const [id, ct] of room.crosstalks.entries()) {
      if (!ct.participantUserIds.has(userId)) {
        continue;
      }
      ct.participantUserIds.delete(userId);
      if (ct.participantUserIds.size < 2) {
        room.crosstalks.delete(id);
        ended.push(id);
      }
    }
    return ended;
  }

  // ── Private helpers ───────────────────────────────────────────

  private ensureRoom(roomKey: string): RoomState {
    const existing = this.rooms.get(roomKey);
    if (existing) {
      return existing;
    }

    const created: RoomState = {
      peersByUserId: new Map<string, Peer>(),
      activeScreenSharerUserId: null,
      crosstalks: new Map<string, Crosstalk>()
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

  getRoomDetails(workspaceId: string, roomId: string): {
    peers: Peer[];
    activeScreenSharerUserId: string | null;
    crosstalks: Crosstalk[];
  } | null {
    const room = this.rooms.get(this.toRoomKey(workspaceId, roomId));
    if (!room) {
      return null;
    }
    return {
      peers: Array.from(room.peersByUserId.values()),
      activeScreenSharerUserId: room.activeScreenSharerUserId,
      crosstalks: Array.from(room.crosstalks.values()),
    };
  }
}
