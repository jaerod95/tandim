import crypto from "node:crypto";
import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app";
import { buildTandimRoomLink, verifySlackSignature } from "../services/slack";

function signBody(rawBody: string, timestamp: string, secret: string): string {
  const base = `v0:${timestamp}:${rawBody}`;
  const digest = crypto.createHmac("sha256", secret).update(base, "utf8").digest("hex");
  return `v0=${digest}`;
}

describe("slack signature verification", () => {
  it("validates known signatures", () => {
    const secret = "test-signing-secret";
    const timestamp = "1700000000";
    const rawBody = "team_id=T1&text=daily-standup";
    const signature = signBody(rawBody, timestamp, secret);
    expect(
      verifySlackSignature({
        signingSecret: secret,
        timestamp,
        rawBody,
        signatureHeader: signature
      })
    ).toBe(true);
  });

  it("builds tandim deep links", () => {
    expect(buildTandimRoomLink("T1", "daily standup")).toBe("tandim://room/T1-daily%20standup");
  });
});

describe("POST /api/slack/commands", () => {
  it("returns a join response on valid signature", async () => {
    const secret = "test-signing-secret";
    const timestamp = "1700000000";
    const rawBody = "team_id=T1&text=daily-standup";

    const response = await request(app)
      .post("/api/slack/commands")
      .set("content-type", "application/x-www-form-urlencoded")
      .set("x-slack-request-timestamp", timestamp)
      .set("x-slack-signature", signBody(rawBody, timestamp, secret))
      .send(rawBody);

    expect(response.status).toBe(200);
    expect(response.body.deep_link).toBe("tandim://room/T1-daily-standup");
  });

  it("rejects invalid signatures", async () => {
    const response = await request(app)
      .post("/api/slack/commands")
      .set("content-type", "application/x-www-form-urlencoded")
      .set("x-slack-request-timestamp", "1700000000")
      .set("x-slack-signature", "v0=invalid")
      .send("team_id=T1&text=daily-standup");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("invalid_slack_signature");
  });
});
