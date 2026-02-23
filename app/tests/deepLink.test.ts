import { describe, expect, it } from "vitest";
import { parseTandemDeepLink } from "../src/deepLink";

describe("parseTandemDeepLink", () => {
  it("parses tandim room links", () => {
    expect(parseTandemDeepLink("tandim://room/abc123")).toEqual({
      type: "room",
      roomId: "abc123"
    });
  });

  it("returns invalid for non-tandem links", () => {
    expect(parseTandemDeepLink("https://example.com/room/abc123")).toEqual({
      type: "invalid",
      reason: "unsupported_protocol"
    });
  });

  it("returns invalid for empty room ids", () => {
    expect(parseTandemDeepLink("tandim://room/")).toEqual({
      type: "invalid",
      reason: "missing_room_id"
    });
  });
});
