import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import app from "../app";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("GET /api/ice-config", () => {
  it("returns default STUN when TURN is not configured", async () => {
    delete process.env.TURN_URL;
    delete process.env.TURN_USERNAME;
    delete process.env.TURN_CREDENTIAL;

    const response = await request(app).get("/api/ice-config");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
    });
  });

  it("includes TURN server when credentials are provided", async () => {
    process.env.STUN_URL = "stun:stun.example.com:3478";
    process.env.TURN_URL = "turn:turn.example.com:3478";
    process.env.TURN_USERNAME = "user1";
    process.env.TURN_CREDENTIAL = "secret1";

    const response = await request(app).get("/api/ice-config");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      iceServers: [
        { urls: "stun:stun.example.com:3478" },
        {
          urls: "turn:turn.example.com:3478",
          username: "user1",
          credential: "secret1"
        }
      ]
    });
  });
});
