import { describe, expect, it } from "vitest";
import { createJoinCommandResponse } from "../src/commands";

describe("createJoinCommandResponse", () => {
  it("returns stable slash command response shape", () => {
    const response = createJoinCommandResponse({
      workspaceId: "T1",
      roomId: "daily-standup"
    });

    expect(response).toEqual({
      response_type: "ephemeral",
      text: "Join room daily-standup",
      deep_link: "tandim://room/T1-daily-standup"
    });
  });
});
