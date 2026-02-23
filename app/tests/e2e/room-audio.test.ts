import { describe, expect, it } from "vitest";
import { createMeshRoomState, upsertPeer } from "../../src/webrtc/meshState";

describe("room-audio", () => {
  it("keeps audio enabled state for joined peers", () => {
    const state = createMeshRoomState("ws1", "room1", "u1");
    upsertPeer(state, { userId: "u1", audioEnabled: true, videoEnabled: true });
    upsertPeer(state, { userId: "u2", audioEnabled: true, videoEnabled: true });

    expect(state.peers.get("u1")?.audioEnabled).toBe(true);
    expect(state.peers.get("u2")?.audioEnabled).toBe(true);
  });
});
