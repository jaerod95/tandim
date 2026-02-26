import { describe, expect, it, beforeEach, afterEach } from "vitest";
import request from "supertest";
import fs from "fs";
import path from "path";
import os from "os";
import express from "express";
import { RoomDefinitionStore } from "../services/roomDefinitions";
import { createRoomDefinitionsRouter } from "../routes/rooms";

function createTestApp(store: RoomDefinitionStore) {
  const app = express();
  app.use(express.json());
  app.use("/api/room-definitions", createRoomDefinitionsRouter(store));
  return app;
}

describe("RoomDefinitionStore", () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tandim-rooms-"));
    filePath = path.join(tmpDir, "rooms.json");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("seeds default rooms when file does not exist", () => {
    const store = new RoomDefinitionStore(filePath);
    const rooms = store.getAllRooms();
    expect(rooms.length).toBe(6);
    expect(rooms[0].name).toBe("Team Standup");
    expect(rooms[5].name).toBe("Library - Co-Working");
    // Should have persisted the file
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("loads rooms from existing file", () => {
    const data = [{ id: "test", name: "test", emoji: "🧪", order: 0 }];
    fs.writeFileSync(filePath, JSON.stringify(data));
    const store = new RoomDefinitionStore(filePath);
    expect(store.getAllRooms()).toEqual(data);
  });

  it("returns rooms sorted by order", () => {
    const data = [
      { id: "b", name: "b", emoji: "🅱️", order: 2 },
      { id: "a", name: "a", emoji: "🅰️", order: 0 },
      { id: "c", name: "c", emoji: "©️", order: 1 },
    ];
    fs.writeFileSync(filePath, JSON.stringify(data));
    const store = new RoomDefinitionStore(filePath);
    const rooms = store.getAllRooms();
    expect(rooms.map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("creates a room with next order", () => {
    fs.writeFileSync(filePath, JSON.stringify([{ id: "x", name: "x", emoji: "❌", order: 3 }]));
    const store = new RoomDefinitionStore(filePath);
    const room = store.createRoom("New Room", "🆕");
    expect(room).toEqual({ id: "New Room", name: "New Room", emoji: "🆕", order: 4 });
    expect(store.getAllRooms().length).toBe(2);
  });

  it("persists created rooms to disk", () => {
    const store = new RoomDefinitionStore(filePath);
    store.createRoom("Persisted", "💾");
    // Read a fresh store from the same file
    const store2 = new RoomDefinitionStore(filePath);
    expect(store2.getRoom("Persisted")).toBeTruthy();
  });

  it("gets a single room by id", () => {
    const store = new RoomDefinitionStore(filePath);
    const room = store.getRoom("Lounge");
    expect(room).toBeTruthy();
    expect(room!.emoji).toBe("🏖️");
  });

  it("returns null for non-existent room", () => {
    const store = new RoomDefinitionStore(filePath);
    expect(store.getRoom("nope")).toBeNull();
  });

  it("updates a room", () => {
    const store = new RoomDefinitionStore(filePath);
    const updated = store.updateRoom("Lounge", { emoji: "🏝️" });
    expect(updated).toBeTruthy();
    expect(updated!.emoji).toBe("🏝️");
    expect(updated!.name).toBe("Lounge");
  });

  it("returns null when updating non-existent room", () => {
    const store = new RoomDefinitionStore(filePath);
    expect(store.updateRoom("nope", { emoji: "🤷" })).toBeNull();
  });

  it("deletes a room", () => {
    const store = new RoomDefinitionStore(filePath);
    expect(store.deleteRoom("Lounge")).toBe(true);
    expect(store.getRoom("Lounge")).toBeNull();
    expect(store.getAllRooms().length).toBe(5);
  });

  it("returns false when deleting non-existent room", () => {
    const store = new RoomDefinitionStore(filePath);
    expect(store.deleteRoom("nope")).toBe(false);
  });

  it("reorders rooms", () => {
    const data = [
      { id: "a", name: "a", emoji: "🅰️", order: 0 },
      { id: "b", name: "b", emoji: "🅱️", order: 1 },
      { id: "c", name: "c", emoji: "©️", order: 2 },
    ];
    fs.writeFileSync(filePath, JSON.stringify(data));
    const store = new RoomDefinitionStore(filePath);
    const reordered = store.reorderRooms(["c", "a", "b"]);
    expect(reordered.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
});

describe("room definitions API routes", () => {
  let tmpDir: string;
  let filePath: string;
  let store: RoomDefinitionStore;
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tandim-rooms-api-"));
    filePath = path.join(tmpDir, "rooms.json");
    store = new RoomDefinitionStore(filePath);
    app = createTestApp(store);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("GET / returns all rooms sorted", async () => {
    const res = await request(app).get("/api/room-definitions");
    expect(res.status).toBe(200);
    expect(res.body.rooms.length).toBe(6);
    expect(res.body.rooms[0].name).toBe("Team Standup");
  });

  it("POST / creates a room", async () => {
    const res = await request(app)
      .post("/api/room-definitions")
      .send({ name: "New Room", emoji: "🆕" });
    expect(res.status).toBe(201);
    expect(res.body.room.id).toBe("New Room");
    expect(res.body.room.order).toBe(6);
  });

  it("POST / rejects empty name", async () => {
    const res = await request(app)
      .post("/api/room-definitions")
      .send({ name: "", emoji: "🆕" });
    expect(res.status).toBe(400);
  });

  it("POST / rejects empty emoji", async () => {
    const res = await request(app)
      .post("/api/room-definitions")
      .send({ name: "Test", emoji: "" });
    expect(res.status).toBe(400);
  });

  it("POST / rejects duplicate name", async () => {
    const res = await request(app)
      .post("/api/room-definitions")
      .send({ name: "Lounge", emoji: "🏖️" });
    expect(res.status).toBe(409);
  });

  it("PUT /:id updates a room", async () => {
    const res = await request(app)
      .put("/api/room-definitions/Lounge")
      .send({ emoji: "🏝️" });
    expect(res.status).toBe(200);
    expect(res.body.room.emoji).toBe("🏝️");
  });

  it("PUT /:id returns 404 for unknown room", async () => {
    const res = await request(app)
      .put("/api/room-definitions/nope")
      .send({ emoji: "🤷" });
    expect(res.status).toBe(404);
  });

  it("DELETE /:id deletes a room", async () => {
    const res = await request(app).delete("/api/room-definitions/Lounge");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const getRes = await request(app).get("/api/room-definitions");
    expect(getRes.body.rooms.length).toBe(5);
  });

  it("DELETE /:id returns 404 for unknown room", async () => {
    const res = await request(app).delete("/api/room-definitions/nope");
    expect(res.status).toBe(404);
  });

  it("PUT /reorder reorders rooms", async () => {
    const rooms = store.getAllRooms();
    const reversed = [...rooms].reverse().map((r) => r.id);
    const res = await request(app)
      .put("/api/room-definitions/reorder")
      .send({ orderedIds: reversed });
    expect(res.status).toBe(200);
    expect(res.body.rooms[0].name).toBe("Library - Co-Working");
  });

  it("PUT /reorder rejects empty array", async () => {
    const res = await request(app)
      .put("/api/room-definitions/reorder")
      .send({ orderedIds: [] });
    expect(res.status).toBe(400);
  });
});
