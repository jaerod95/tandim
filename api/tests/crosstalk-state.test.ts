import { describe, expect, it } from "vitest";
import { RoomStateStore } from "../services/roomState";

function setupRoom(store: RoomStateStore, userCount: number) {
  for (let i = 1; i <= userCount; i++) {
    store.joinPeer({
      workspaceId: "ws1",
      roomId: "room1",
      userId: `u${i}`,
      displayName: `User ${i}`,
      socketId: `s${i}`,
      nowMs: 100 + i,
    });
  }
}

describe("Crosstalk state", () => {
  it("starts a crosstalk between two users", () => {
    const store = new RoomStateStore();
    setupRoom(store, 3);

    const result = store.startCrosstalk("s1", ["u2"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.crosstalk.initiatorUserId).toBe("u1");
    expect(result.crosstalk.participantUserIds.sort()).toEqual(["u1", "u2"]);
    expect(result.autoLeftCrosstalkIds).toEqual([]);
  });

  it("allows multiple concurrent crosstalks between different pairs", () => {
    const store = new RoomStateStore();
    setupRoom(store, 4);

    const ct1 = store.startCrosstalk("s1", ["u2"]);
    expect(ct1.ok).toBe(true);

    const ct2 = store.startCrosstalk("s3", ["u4"]);
    expect(ct2.ok).toBe(true);

    if (!ct1.ok || !ct2.ok) return;

    expect(ct1.crosstalk.id).not.toBe(ct2.crosstalk.id);

    const crosstalks = store.getCrosstalks("ws1", "room1");
    expect(crosstalks).toHaveLength(2);
  });

  it("auto-leaves existing crosstalk when user joins a new one", () => {
    const store = new RoomStateStore();
    setupRoom(store, 3);

    const ct1 = store.startCrosstalk("s1", ["u2"]);
    expect(ct1.ok).toBe(true);
    if (!ct1.ok) return;

    // u1 starts a new crosstalk with u3, should auto-leave ct1
    const ct2 = store.startCrosstalk("s1", ["u3"]);
    expect(ct2.ok).toBe(true);
    if (!ct2.ok) return;

    // ct1 should have been removed (only u2 left, < 2 participants)
    expect(ct2.autoLeftCrosstalkIds).toContain(ct1.crosstalk.id);

    const crosstalks = store.getCrosstalks("ws1", "room1");
    expect(crosstalks).toHaveLength(1);
    expect(crosstalks[0].id).toBe(ct2.crosstalk.id);
  });

  it("auto-leaves target users from their existing crosstalks", () => {
    const store = new RoomStateStore();
    setupRoom(store, 4);

    // u1 and u2 are in a crosstalk
    const ct1 = store.startCrosstalk("s1", ["u2"]);
    expect(ct1.ok).toBe(true);
    if (!ct1.ok) return;

    // u3 starts a crosstalk pulling u2 — u2 auto-leaves ct1
    const ct2 = store.startCrosstalk("s3", ["u2"]);
    expect(ct2.ok).toBe(true);
    if (!ct2.ok) return;

    expect(ct2.autoLeftCrosstalkIds).toContain(ct1.crosstalk.id);

    const crosstalks = store.getCrosstalks("ws1", "room1");
    expect(crosstalks).toHaveLength(1);
    expect(crosstalks[0].id).toBe(ct2.crosstalk.id);
    expect(crosstalks[0].participantUserIds.sort()).toEqual(["u2", "u3"]);
  });

  it("keeps a crosstalk alive when one user leaves a 3-person crosstalk", () => {
    const store = new RoomStateStore();
    setupRoom(store, 4);

    const ct = store.startCrosstalk("s1", ["u2", "u3"]);
    expect(ct.ok).toBe(true);
    if (!ct.ok) return;

    // u3 joins a different crosstalk, leaving the original one
    const ct2 = store.startCrosstalk("s3", ["u4"]);
    expect(ct2.ok).toBe(true);
    if (!ct2.ok) return;

    // Original crosstalk should still exist with u1 and u2
    const crosstalks = store.getCrosstalks("ws1", "room1");
    expect(crosstalks).toHaveLength(2);

    const original = crosstalks.find((c) => c.id === ct.crosstalk.id);
    expect(original).toBeDefined();
    expect(original!.participantUserIds.sort()).toEqual(["u1", "u2"]);
  });

  it("ends a crosstalk explicitly", () => {
    const store = new RoomStateStore();
    setupRoom(store, 3);

    const ct = store.startCrosstalk("s1", ["u2"]);
    expect(ct.ok).toBe(true);
    if (!ct.ok) return;

    const result = store.endCrosstalk("s1", ct.crosstalk.id);
    expect(result.ok).toBe(true);

    const crosstalks = store.getCrosstalks("ws1", "room1");
    expect(crosstalks).toHaveLength(0);
  });

  it("rejects ending a crosstalk the user is not in", () => {
    const store = new RoomStateStore();
    setupRoom(store, 3);

    const ct = store.startCrosstalk("s1", ["u2"]);
    expect(ct.ok).toBe(true);
    if (!ct.ok) return;

    const result = store.endCrosstalk("s3", ct.crosstalk.id);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_in_crosstalk");
  });

  it("cleans up crosstalks on disconnect", () => {
    const store = new RoomStateStore();
    setupRoom(store, 3);

    const ct = store.startCrosstalk("s1", ["u2"]);
    expect(ct.ok).toBe(true);
    if (!ct.ok) return;

    // u1 disconnects
    const leaveResult = store.leaveBySocket("s1");
    expect(leaveResult).not.toBeNull();
    expect(leaveResult!.removedCrosstalkIds).toContain(ct.crosstalk.id);

    const crosstalks = store.getCrosstalks("ws1", "room1");
    expect(crosstalks).toHaveLength(0);
  });

  it("cleans up multiple crosstalks on disconnect", () => {
    const store = new RoomStateStore();
    setupRoom(store, 5);

    // u1-u2 crosstalk
    const ct1 = store.startCrosstalk("s1", ["u2"]);
    // u3-u4 crosstalk
    const ct2 = store.startCrosstalk("s3", ["u4"]);
    expect(ct1.ok).toBe(true);
    expect(ct2.ok).toBe(true);
    if (!ct1.ok || !ct2.ok) return;

    // u1 disconnects — only ct1 is affected
    const leaveResult = store.leaveBySocket("s1");
    expect(leaveResult!.removedCrosstalkIds).toContain(ct1.crosstalk.id);
    expect(leaveResult!.removedCrosstalkIds).not.toContain(ct2.crosstalk.id);

    // ct2 still exists
    const crosstalks = store.getCrosstalks("ws1", "room1");
    expect(crosstalks).toHaveLength(1);
    expect(crosstalks[0].id).toBe(ct2.crosstalk.id);
  });

  it("rejects crosstalk with non-room member", () => {
    const store = new RoomStateStore();
    setupRoom(store, 2);

    const result = store.startCrosstalk("s1", ["u_nonexistent"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("target_not_in_room");
  });

  it("rejects crosstalk with self", () => {
    const store = new RoomStateStore();
    setupRoom(store, 2);

    const result = store.startCrosstalk("s1", ["u1"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("cannot_crosstalk_self");
  });

  it("rejects starting crosstalk when not in room", () => {
    const store = new RoomStateStore();

    const result = store.startCrosstalk("s_unknown", ["u1"]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not_in_room");
  });

  it("reports crosstalks in room details", () => {
    const store = new RoomStateStore();
    setupRoom(store, 3);

    const ct = store.startCrosstalk("s1", ["u2"]);
    expect(ct.ok).toBe(true);
    if (!ct.ok) return;

    const details = store.getRoomDetails("ws1", "room1");
    expect(details).not.toBeNull();
    expect(details!.crosstalks).toHaveLength(1);
    expect(details!.crosstalks[0].id).toBe(ct.crosstalk.id);
    expect(details!.crosstalks[0].participantUserIds.sort()).toEqual(["u1", "u2"]);
  });
});
