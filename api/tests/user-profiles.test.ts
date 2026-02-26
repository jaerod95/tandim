import request from "supertest";
import fs from "fs";
import path from "path";
import { describe, expect, it, beforeAll, beforeEach, afterEach } from "vitest";
import app, { mountErrorHandlers } from "../app";
import { UserProfileStore } from "../services/userProfiles";
import { createProfilesRouter } from "../routes/profiles";

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "profiles.json");

function cleanDataFile() {
  try {
    if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
  } catch { /* ignore */ }
}

describe("UserProfileStore", () => {
  let store: UserProfileStore;

  beforeEach(() => {
    cleanDataFile();
    store = new UserProfileStore();
  });

  afterEach(() => {
    cleanDataFile();
  });

  it("creates a profile with default settings", () => {
    const profile = store.createProfile("u-1", "Alice");
    expect(profile).toEqual({
      userId: "u-1",
      displayName: "Alice",
      settings: { notificationSounds: true, autoJoinAudio: true },
    });
  });

  it("returns null for unknown user", () => {
    expect(store.getProfile("unknown")).toBeNull();
  });

  it("gets an existing profile", () => {
    store.createProfile("u-1", "Alice");
    const profile = store.getProfile("u-1");
    expect(profile?.displayName).toBe("Alice");
  });

  it("updates display name", () => {
    store.createProfile("u-1", "Alice");
    const updated = store.updateProfile("u-1", { displayName: "Alice B" });
    expect(updated?.displayName).toBe("Alice B");
  });

  it("updates avatar URL", () => {
    store.createProfile("u-1", "Alice");
    const updated = store.updateProfile("u-1", { avatarUrl: "https://example.com/avatar.png" });
    expect(updated?.avatarUrl).toBe("https://example.com/avatar.png");
  });

  it("updates settings partially", () => {
    store.createProfile("u-1", "Alice");
    const updated = store.updateProfile("u-1", { settings: { notificationSounds: false } });
    expect(updated?.settings).toEqual({ notificationSounds: false, autoJoinAudio: true });
  });

  it("returns null when updating nonexistent profile", () => {
    expect(store.updateProfile("unknown", { displayName: "Bob" })).toBeNull();
  });

  it("lists all profiles", () => {
    store.createProfile("u-1", "Alice");
    store.createProfile("u-2", "Bob");
    const all = store.getAllProfiles();
    expect(all).toHaveLength(2);
    expect(all.map((p) => p.userId).sort()).toEqual(["u-1", "u-2"]);
  });

  it("deletes a profile", () => {
    store.createProfile("u-1", "Alice");
    expect(store.deleteProfile("u-1")).toBe(true);
    expect(store.getProfile("u-1")).toBeNull();
  });

  it("returns false when deleting nonexistent profile", () => {
    expect(store.deleteProfile("unknown")).toBe(false);
  });

  it("persists to disk and loads on new instance", () => {
    store.createProfile("u-1", "Alice");
    store.updateProfile("u-1", { settings: { autoJoinAudio: false } });

    const store2 = new UserProfileStore();
    const profile = store2.getProfile("u-1");
    expect(profile?.displayName).toBe("Alice");
    expect(profile?.settings.autoJoinAudio).toBe(false);
  });
});

describe("profiles API routes", () => {
  let store: UserProfileStore;

  beforeAll(() => {
    cleanDataFile();
    store = new UserProfileStore();
    app.use("/api/profiles", createProfilesRouter(store));
    mountErrorHandlers();
  });

  beforeEach(() => {
    // Reset store state between tests by deleting all profiles
    for (const p of store.getAllProfiles()) {
      store.deleteProfile(p.userId);
    }
  });

  afterEach(() => {
    cleanDataFile();
  });

  it("GET /api/profiles returns empty list initially", async () => {
    const res = await request(app).get("/api/profiles");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ profiles: [] });
  });

  it("POST /api/profiles creates a profile", async () => {
    const res = await request(app)
      .post("/api/profiles")
      .send({ userId: "u-1", displayName: "Alice" });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe("u-1");
    expect(res.body.displayName).toBe("Alice");
    expect(res.body.settings).toEqual({ notificationSounds: true, autoJoinAudio: true });
  });

  it("POST /api/profiles rejects duplicate userId", async () => {
    await request(app).post("/api/profiles").send({ userId: "u-1", displayName: "Alice" });
    const res = await request(app)
      .post("/api/profiles")
      .send({ userId: "u-1", displayName: "Alice Again" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("conflict");
  });

  it("POST /api/profiles rejects invalid body", async () => {
    const res = await request(app).post("/api/profiles").send({ userId: "" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation_error");
  });

  it("GET /api/profiles/:userId returns a profile", async () => {
    await request(app).post("/api/profiles").send({ userId: "u-1", displayName: "Alice" });
    const res = await request(app).get("/api/profiles/u-1");
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Alice");
  });

  it("GET /api/profiles/:userId returns 404 for unknown", async () => {
    const res = await request(app).get("/api/profiles/unknown");
    expect(res.status).toBe(404);
  });

  it("PUT /api/profiles/:userId updates a profile", async () => {
    await request(app).post("/api/profiles").send({ userId: "u-1", displayName: "Alice" });
    const res = await request(app)
      .put("/api/profiles/u-1")
      .send({ displayName: "Alice B", settings: { notificationSounds: false } });
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe("Alice B");
    expect(res.body.settings.notificationSounds).toBe(false);
    expect(res.body.settings.autoJoinAudio).toBe(true);
  });

  it("PUT /api/profiles/:userId returns 404 for unknown", async () => {
    const res = await request(app)
      .put("/api/profiles/unknown")
      .send({ displayName: "Nobody" });
    expect(res.status).toBe(404);
  });

  it("PUT /api/profiles/:userId rejects invalid body", async () => {
    await request(app).post("/api/profiles").send({ userId: "u-1", displayName: "Alice" });
    const res = await request(app)
      .put("/api/profiles/u-1")
      .send({ avatarUrl: "not-a-url" });
    expect(res.status).toBe(400);
  });

  it("GET /api/profiles lists all profiles", async () => {
    await request(app).post("/api/profiles").send({ userId: "u-1", displayName: "Alice" });
    await request(app).post("/api/profiles").send({ userId: "u-2", displayName: "Bob" });
    const res = await request(app).get("/api/profiles");
    expect(res.status).toBe(200);
    expect(res.body.profiles).toHaveLength(2);
  });
});
