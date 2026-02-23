import { describe, expect, it } from "vitest";
import { createMeshRoomState, setPeerMedia, upsertPeer } from "../../src/webrtc/meshState";

describe("room-video", () => {
  it("updates camera toggles for participants", () => {
    const state = createMeshRoomState("ws1", "room1", "u1");
    upsertPeer(state, { userId: "u1", audioEnabled: true, videoEnabled: false });

    setPeerMedia(state, "u1", { videoEnabled: true });
    expect(state.peers.get("u1")?.videoEnabled).toBe(true);
  });
});
