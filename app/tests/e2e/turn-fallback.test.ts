import { describe, expect, it } from "vitest";
import { selectIceMode } from "../../src/webrtc/iceFallback";

describe("turn-fallback", () => {
  it("falls back to relay mode when direct ICE fails", () => {
    expect(
      selectIceMode({
        directConnectionSucceeded: false,
        relayConnectionSucceeded: true,
      }),
    ).toBe("relay");
  });

  it("fails when neither direct nor relay connects", () => {
    expect(
      selectIceMode({
        directConnectionSucceeded: false,
        relayConnectionSucceeded: false,
      }),
    ).toBe("failed");
  });
});
