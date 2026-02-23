import { describe, expect, it } from "vitest";
import { RoomStateStore } from "../services/roomState";

describe("RoomStateStore", () => {
  it("tracks peer join and disconnect cleanup", () => {
    const store = new RoomStateStore();
    store.joinPeer({
      workspaceId: "ws1",
      roomId: "room1",
      userId: "u1",
      displayName: "User One",
      socketId: "s1",
      nowMs: 100
    });
    store.joinPeer({
      workspaceId: "ws1",
      roomId: "room1",
      userId: "u2",
      displayName: "User Two",
      socketId: "s2",
      nowMs: 101
    });

    expect(store.getRoomPeerCount("ws1", "room1")).toBe(2);

    const removed = store.leaveBySocket("s2");
    expect(removed?.userId).toBe("u2");
    expect(store.getRoomPeerCount("ws1", "room1")).toBe(1);
  });

  it("prunes stale presence entries", () => {
    const store = new RoomStateStore();
    store.joinPeer({
      workspaceId: "ws1",
      roomId: "room1",
      userId: "u1",
      displayName: "User One",
      socketId: "s1",
      nowMs: 100
    });
    store.joinPeer({
      workspaceId: "ws1",
      roomId: "room1",
      userId: "u2",
      displayName: "User Two",
      socketId: "s2",
      nowMs: 150
    });

    const removed = store.pruneInactivePeers(70, 200);
    expect(removed).toEqual([{ roomKey: { workspaceId: "ws1", roomId: "room1" }, userId: "u1" }]);
    expect(store.getRoomPeerCount("ws1", "room1")).toBe(1);
  });

  it("enforces one active screen share at a time", () => {
    const store = new RoomStateStore();
    store.joinPeer({
      workspaceId: "ws1",
      roomId: "room1",
      userId: "u1",
      displayName: "User One",
      socketId: "s1",
      nowMs: 100
    });
    store.joinPeer({
      workspaceId: "ws1",
      roomId: "room1",
      userId: "u2",
      displayName: "User Two",
      socketId: "s2",
      nowMs: 101
    });

    expect(store.startScreenShare("s1")).toEqual({
      ok: true,
      roomKey: { workspaceId: "ws1", roomId: "room1" },
      userId: "u1"
    });
    expect(store.startScreenShare("s2")).toEqual({
      ok: false,
      reason: "screen_share_already_active"
    });
  });
});
