import { describe, expect, it } from "vitest";
import { PresenceState } from "../src/presence";

describe("PresenceState", () => {
  it("keeps local user first and sorts others by name", () => {
    const presence = new PresenceState();
    presence.upsert({ userId: "u2", displayName: "Zane", state: "connected" });
    presence.upsert({ userId: "u1", displayName: "You", state: "you" });
    presence.upsert({ userId: "u3", displayName: "Alice", state: "connected" });

    expect(presence.snapshot().map((u) => u.userId)).toEqual([
      "u1",
      "u3",
      "u2",
    ]);
  });

  it("removes users cleanly", () => {
    const presence = new PresenceState();
    presence.upsert({ userId: "u1", displayName: "You", state: "you" });
    presence.upsert({ userId: "u2", displayName: "Peer", state: "connected" });
    presence.remove("u2");

    expect(presence.snapshot()).toEqual([
      { userId: "u1", displayName: "You", state: "you" },
    ]);
  });
});
