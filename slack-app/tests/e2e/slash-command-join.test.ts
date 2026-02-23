import { describe, expect, it } from "vitest";
import { createJoinCommandResponse } from "../../src/commands";

describe("slash-command-join", () => {
  it("builds a one-click deep link response", () => {
    const response = createJoinCommandResponse({
      workspaceId: "T1",
      roomId: "incident-war-room"
    });
    expect(response.deep_link).toBe("tandim://room/T1-incident-war-room");
  });
});
