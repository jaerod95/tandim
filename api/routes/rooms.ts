import { Router } from "express";
import { z } from "zod";
import type { RoomDefinitionStore } from "../services/roomDefinitions";

const CreateRoomSchema = z.object({
  name: z.string().min(1, "Name is required"),
  emoji: z.string().min(1, "Emoji is required"),
});

const UpdateRoomSchema = z.object({
  name: z.string().min(1).optional(),
  emoji: z.string().min(1).optional(),
  order: z.number().int().min(0).optional(),
});

const ReorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
});

export function createRoomDefinitionsRouter(store: RoomDefinitionStore): Router {
  const router = Router();

  // Must come before /:id to avoid matching "reorder" as an id
  router.put("/reorder", (req, res) => {
    const parsed = ReorderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }
    const rooms = store.reorderRooms(parsed.data.orderedIds);
    res.json({ rooms });
  });

  router.get("/", (_req, res) => {
    res.json({ rooms: store.getAllRooms() });
  });

  router.post("/", (req, res) => {
    const parsed = CreateRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const { name, emoji } = parsed.data;

    // Prevent duplicate names
    if (store.getRoom(name)) {
      res.status(409).json({ error: "A room with that name already exists" });
      return;
    }

    const room = store.createRoom(name, emoji);
    res.status(201).json({ room });
  });

  router.put("/:id", (req, res) => {
    const parsed = UpdateRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      return;
    }

    const room = store.updateRoom(req.params.id, parsed.data);
    if (!room) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    res.json({ room });
  });

  router.delete("/:id", (req, res) => {
    const deleted = store.deleteRoom(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Room not found" });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
