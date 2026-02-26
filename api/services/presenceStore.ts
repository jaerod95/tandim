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

export class PresenceStore {
  // socketId -> UserPresence
  private readonly bySocket = new Map<string, UserPresence>();
  // workspaceId -> Set<socketId>
  private readonly workspaceSockets = new Map<string, Set<string>>();

  setPresence(socketId: string, data: {
    userId: string;
    displayName: string;
    workspaceId: string;
    status?: PresenceStatus;
  }): UserPresence {
    const existing = this.bySocket.get(socketId);
    const presence: UserPresence = {
      userId: data.userId,
      displayName: data.displayName,
      status: data.status ?? existing?.status ?? "available",
      currentRoom: existing?.currentRoom,
      lastSeen: Date.now(),
      socketId,
      workspaceId: data.workspaceId,
    };

    this.bySocket.set(socketId, presence);

    let sockets = this.workspaceSockets.get(data.workspaceId);
    if (!sockets) {
      sockets = new Set();
      this.workspaceSockets.set(data.workspaceId, sockets);
    }
    sockets.add(socketId);

    return presence;
  }

  removeBySocket(socketId: string): UserPresence | null {
    const presence = this.bySocket.get(socketId);
    if (!presence) return null;

    this.bySocket.delete(socketId);

    const sockets = this.workspaceSockets.get(presence.workspaceId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.workspaceSockets.delete(presence.workspaceId);
      }
    }

    return presence;
  }

  getBySocket(socketId: string): UserPresence | null {
    return this.bySocket.get(socketId) ?? null;
  }

  getAll(workspaceId: string): UserPresence[] {
    const sockets = this.workspaceSockets.get(workspaceId);
    if (!sockets) return [];

    const result: UserPresence[] = [];
    for (const sid of sockets) {
      const p = this.bySocket.get(sid);
      if (p) result.push(p);
    }
    return result;
  }

  findByUserId(workspaceId: string, userId: string): UserPresence | null {
    const sockets = this.workspaceSockets.get(workspaceId);
    if (!sockets) return null;
    for (const sid of sockets) {
      const p = this.bySocket.get(sid);
      if (p && p.userId === userId) return p;
    }
    return null;
  }

  setStatus(socketId: string, status: PresenceStatus): UserPresence | null {
    const presence = this.bySocket.get(socketId);
    if (!presence) return null;
    presence.status = status;
    presence.lastSeen = Date.now();
    return presence;
  }

  setInCall(socketId: string, room: { workspaceId: string; roomId: string }): UserPresence | null {
    const presence = this.bySocket.get(socketId);
    if (!presence) return null;
    presence.status = "in-call";
    presence.currentRoom = room;
    presence.lastSeen = Date.now();
    return presence;
  }

  clearCall(socketId: string): UserPresence | null {
    const presence = this.bySocket.get(socketId);
    if (!presence) return null;
    // Only revert to available if they were in a call
    if (presence.status === "in-call") {
      presence.status = "available";
    }
    presence.currentRoom = undefined;
    presence.lastSeen = Date.now();
    return presence;
  }

  pruneStale(maxAgeMs: number): UserPresence[] {
    const now = Date.now();
    const pruned: UserPresence[] = [];

    for (const [socketId, presence] of this.bySocket) {
      if (now - presence.lastSeen > maxAgeMs) {
        this.removeBySocket(socketId);
        pruned.push(presence);
      }
    }

    return pruned;
  }
}
