import { describe, expect, it } from "vitest";
import {
  createMeshRoomState,
  removePeer,
  setPeerMedia,
  startScreenShare,
  stopScreenShare,
  upsertPeer
} from "../src/webrtc/meshState";

describe("mesh room state", () => {
  it("tracks room membership and cleanup", () => {
    const state = createMeshRoomState("ws1", "room1", "u1");
    upsertPeer(state, { userId: "u1", audioEnabled: true, videoEnabled: true });
    upsertPeer(state, { userId: "u2", audioEnabled: true, videoEnabled: false });
    expect(Array.from(state.peers.keys()).sort()).toEqual(["u1", "u2"]);

    removePeer(state, "u2");
    expect(Array.from(state.peers.keys())).toEqual(["u1"]);
  });

  it("updates peer video state", () => {
    const state = createMeshRoomState("ws1", "room1", "u1");
    upsertPeer(state, { userId: "u2", audioEnabled: true, videoEnabled: false });
    setPeerMedia(state, "u2", { videoEnabled: true });
    expect(state.peers.get("u2")?.videoEnabled).toBe(true);
  });

  it("enforces one active screen sharer", () => {
    const state = createMeshRoomState("ws1", "room1", "u1");
    expect(startScreenShare(state, "u1")).toEqual({ ok: true });
    expect(startScreenShare(state, "u2")).toEqual({ ok: false });
    stopScreenShare(state, "u1");
    expect(state.activeScreenSharerUserId).toBeNull();
  });
});
