import { describe, expect, it } from "vitest";
import { createMeshRoomState, startScreenShare, stopScreenShare } from "../../src/webrtc/meshState";

describe("room-screen-share", () => {
  it("allows one active screen sharer with clean stop", () => {
    const state = createMeshRoomState("ws1", "room1", "u1");
    expect(startScreenShare(state, "u1")).toEqual({ ok: true });
    expect(startScreenShare(state, "u2")).toEqual({ ok: false });

    stopScreenShare(state, "u1");
    expect(state.activeScreenSharerUserId).toBeNull();
  });
});
