import { describe, expect, it } from "vitest";
import { validateConfig } from "../services/config";

describe("validateConfig", () => {
  it("accepts required production variables", () => {
    const config = validateConfig({
      NODE_ENV: "production",
      SLACK_SIGNING_SECRET: "secret",
      STUN_URL: "stun:stun.l.google.com:19302",
      TURN_URL: "turn:turn.example.com:3478",
      TURN_USERNAME: "user1",
      TURN_CREDENTIAL: "pass1"
    });
    expect(config.NODE_ENV).toBe("production");
    expect(config.STUN_URL).toContain("stun:");
  });

  it("throws when required variables are missing", () => {
    expect(() =>
      validateConfig({
        NODE_ENV: "production"
      })
    ).toThrow();
  });
});
