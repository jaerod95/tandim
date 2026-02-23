import { describe, expect, it } from "vitest";
import { computeReconnectDelayMs, shouldRetryConnection } from "../src/webrtc/reconnect";

describe("reconnect backoff", () => {
  it("uses exponential backoff with cap", () => {
    expect(computeReconnectDelayMs(0)).toBe(500);
    expect(computeReconnectDelayMs(1)).toBe(1000);
    expect(computeReconnectDelayMs(2)).toBe(2000);
    expect(computeReconnectDelayMs(10)).toBe(32000);
  });

  it("does not retry auth-style terminal failures", () => {
    expect(shouldRetryConnection("auth_failed")).toBe(false);
    expect(shouldRetryConnection("forbidden_workspace")).toBe(false);
    expect(shouldRetryConnection("network_error")).toBe(true);
  });
});
