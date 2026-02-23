import { describe, expect, it } from "vitest";
import { buildDesktopRoomDeepLink } from "../src/deepLink";

describe("buildDesktopRoomDeepLink", () => {
  it("builds a tandim protocol URL for room IDs", () => {
    expect(buildDesktopRoomDeepLink("abc-123")).toBe("tandim://room/abc-123");
  });
});
