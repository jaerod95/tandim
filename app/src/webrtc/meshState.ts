export type PeerMediaState = {
  userId: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
};

export type MeshRoomState = {
  workspaceId: string;
  roomId: string;
  localUserId: string;
  peers: Map<string, PeerMediaState>;
  activeScreenSharerUserId: string | null;
};

export function createMeshRoomState(
  workspaceId: string,
  roomId: string,
  localUserId: string
): MeshRoomState {
  return {
    workspaceId,
    roomId,
    localUserId,
    peers: new Map<string, PeerMediaState>(),
    activeScreenSharerUserId: null
  };
}

export function upsertPeer(state: MeshRoomState, peer: PeerMediaState): void {
  state.peers.set(peer.userId, peer);
}

export function removePeer(state: MeshRoomState, userId: string): void {
  state.peers.delete(userId);
  if (state.activeScreenSharerUserId === userId) {
    state.activeScreenSharerUserId = null;
  }
}

export function setPeerMedia(
  state: MeshRoomState,
  userId: string,
  updates: Partial<Pick<PeerMediaState, "audioEnabled" | "videoEnabled">>
): void {
  const peer = state.peers.get(userId);
  if (!peer) {
    return;
  }

  state.peers.set(userId, {
    ...peer,
    ...updates
  });
}

export function startScreenShare(state: MeshRoomState, userId: string): { ok: true } | { ok: false } {
  if (state.activeScreenSharerUserId && state.activeScreenSharerUserId !== userId) {
    return { ok: false };
  }
  state.activeScreenSharerUserId = userId;
  return { ok: true };
}

export function stopScreenShare(state: MeshRoomState, userId: string): void {
  if (state.activeScreenSharerUserId === userId) {
    state.activeScreenSharerUserId = null;
  }
}
