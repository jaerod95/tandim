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

type RoomState = {
  peersByUserId: Map<string, Peer>;
  activeScreenSharerUserId: string | null;
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

  leaveBySocket(socketId: string): { roomKey: RoomKey; userId: string; activeScreenSharerUserId: string | null } | null {
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

    if (room.peersByUserId.size === 0) {
      this.rooms.delete(membership.roomKey);
    }

    return {
      roomKey: { workspaceId: membership.workspaceId, roomId: membership.roomId },
      userId: membership.userId,
      activeScreenSharerUserId: room.activeScreenSharerUserId
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

  pruneInactivePeers(maxInactivityMs: number, nowMs?: number): Array<{ roomKey: RoomKey; userId: string }> {
    const now = nowMs ?? Date.now();
    const removed: Array<{ roomKey: RoomKey; userId: string }> = [];

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
        removed.push({ roomKey: { workspaceId, roomId }, userId: peer.userId });
      }

      if (room.peersByUserId.size === 0) {
        this.rooms.delete(key);
      }
    }

    return removed;
  }

  private ensureRoom(roomKey: string): RoomState {
    const existing = this.rooms.get(roomKey);
    if (existing) {
      return existing;
    }

    const created: RoomState = {
      peersByUserId: new Map<string, Peer>(),
      activeScreenSharerUserId: null
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

  getRoomDetails(workspaceId: string, roomId: string): { peers: Peer[]; activeScreenSharerUserId: string | null } | null {
    const room = this.rooms.get(this.toRoomKey(workspaceId, roomId));
    if (!room) {
      return null;
    }
    return {
      peers: Array.from(room.peersByUserId.values()),
      activeScreenSharerUserId: room.activeScreenSharerUserId,
    };
  }
}
