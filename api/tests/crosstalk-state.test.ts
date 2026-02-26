import { describe, expect, it } from "vitest";
import { RoomStateStore } from "../services/roomState";

function makeStore() {
  const store = new RoomStateStore();
  store.joinPeer({ workspaceId: "ws1", roomId: "room1", userId: "u1", displayName: "User One", socketId: "s1", nowMs: 100 });
  store.joinPeer({ workspaceId: "ws1", roomId: "room1", userId: "u2", displayName: "User Two", socketId: "s2", nowMs: 100 });
  store.joinPeer({ workspaceId: "ws1", roomId: "room1", userId: "u3", displayName: "User Three", socketId: "s3", nowMs: 100 });
  return store;
}

describe("RoomStateStore crosstalk", () => {
  it("starts and tracks a crosstalk", () => {
    const store = makeStore();
    const result = store.startCrosstalk("ws1", "room1", "u1", ["u2"]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.crosstalk.initiatorUserId).toBe("u1");
    expect(Array.from(result.crosstalk.participantUserIds).sort()).toEqual(["u1", "u2"]);

    const crosstalks = store.getCrosstalksInRoom("ws1", "room1");
    expect(crosstalks).toHaveLength(1);
    expect(crosstalks[0].id).toBe(result.crosstalk.id);
  });

  it("returns the crosstalk a user is in", () => {
    const store = makeStore();
    const result = store.startCrosstalk("ws1", "room1", "u1", ["u2"]);
    if (!result.ok) throw new Error("unexpected");

    expect(store.getCrosstalkForUser("ws1", "room1", "u1")?.id).toBe(result.crosstalk.id);
    expect(store.getCrosstalkForUser("ws1", "room1", "u2")?.id).toBe(result.crosstalk.id);
    expect(store.getCrosstalkForUser("ws1", "room1", "u3")).toBeNull();
  });

  it("ends a crosstalk", () => {
    const store = makeStore();
    const result = store.startCrosstalk("ws1", "room1", "u1", ["u2"]);
    if (!result.ok) throw new Error("unexpected");

    const endResult = store.endCrosstalk("ws1", "room1", result.crosstalk.id, "u1");
    expect(endResult.ok).toBe(true);
    expect(store.getCrosstalksInRoom("ws1", "room1")).toHaveLength(0);
  });

  it("rejects ending crosstalk by non-participant", () => {
    const store = makeStore();
    const result = store.startCrosstalk("ws1", "room1", "u1", ["u2"]);
    if (!result.ok) throw new Error("unexpected");

    const endResult = store.endCrosstalk("ws1", "room1", result.crosstalk.id, "u3");
    expect(endResult.ok).toBe(false);
    if (endResult.ok) return;
    expect(endResult.reason).toBe("not_in_crosstalk");
  });

  it("rejects starting crosstalk if initiator not in room", () => {
    const store = makeStore();
    const result = store.startCrosstalk("ws1", "room1", "unknown", ["u2"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("initiator_not_in_room");
  });

  it("rejects starting crosstalk if target not in room", () => {
    const store = makeStore();
    const result = store.startCrosstalk("ws1", "room1", "u1", ["not_here"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("target_not_in_room");
  });

  it("rejects starting crosstalk if initiator already in one", () => {
    const store = makeStore();
    store.startCrosstalk("ws1", "room1", "u1", ["u2"]);
    const result = store.startCrosstalk("ws1", "room1", "u1", ["u3"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("already_in_crosstalk");
  });

  it("rejects starting crosstalk if target already in one", () => {
    const store = makeStore();
    store.startCrosstalk("ws1", "room1", "u1", ["u2"]);
    const result = store.startCrosstalk("ws1", "room1", "u3", ["u2"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("target_already_in_crosstalk");
  });

  it("auto-ends crosstalk when peer leaves and fewer than 2 remain", () => {
    const store = makeStore();
    const result = store.startCrosstalk("ws1", "room1", "u1", ["u2"]);
    if (!result.ok) throw new Error("unexpected");

    const leaveResult = store.leaveBySocket("s2");
    expect(leaveResult).not.toBeNull();
    expect(leaveResult!.endedCrosstalkIds).toEqual([result.crosstalk.id]);
    expect(store.getCrosstalksInRoom("ws1", "room1")).toHaveLength(0);
  });

  it("keeps crosstalk alive when a non-critical participant leaves a 3-person crosstalk", () => {
    const store = makeStore();
    const result = store.startCrosstalk("ws1", "room1", "u1", ["u2", "u3"]);
    if (!result.ok) throw new Error("unexpected");

    const leaveResult = store.leaveBySocket("s3");
    expect(leaveResult!.endedCrosstalkIds).toEqual([]);
    // Crosstalk still exists with u1 and u2
    const ct = store.getCrosstalkForUser("ws1", "room1", "u1");
    expect(ct).not.toBeNull();
    expect(Array.from(ct!.participantUserIds).sort()).toEqual(["u1", "u2"]);
  });

  it("auto-ends crosstalk on prune of inactive peer", () => {
    const store = new RoomStateStore();
    store.joinPeer({ workspaceId: "ws1", roomId: "room1", userId: "u1", displayName: "User One", socketId: "s1", nowMs: 100 });
    store.joinPeer({ workspaceId: "ws1", roomId: "room1", userId: "u2", displayName: "User Two", socketId: "s2", nowMs: 100 });
    store.startCrosstalk("ws1", "room1", "u1", ["u2"]);

    // Only u1 sends heartbeat, u2 goes stale
    store.updateHeartbeat("s1", 200);

    const removed = store.pruneInactivePeers(70, 200);
    expect(removed).toHaveLength(1);
    expect(removed[0].endedCrosstalkIds).toHaveLength(1);
    expect(store.getCrosstalksInRoom("ws1", "room1")).toHaveLength(0);
  });

  it("includes crosstalks in getRoomDetails", () => {
    const store = makeStore();
    store.startCrosstalk("ws1", "room1", "u1", ["u2"]);

    const details = store.getRoomDetails("ws1", "room1");
    expect(details).not.toBeNull();
    expect(details!.crosstalks).toHaveLength(1);
    expect(details!.crosstalks[0].initiatorUserId).toBe("u1");
  });
});
