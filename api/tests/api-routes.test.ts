import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../app";

describe("api routing contract", () => {
  it("returns 200 for GET /api/health", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "api"
    });
  });

  it("returns JSON 404 for unknown /api routes", async () => {
    const response = await request(app).get("/api/does-not-exist");
    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      code: "not_found",
      message: "API route not found",
      retryable: false
    });
  });
});
