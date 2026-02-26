import { Router } from "express";
import { z } from "zod";
import type { UserProfileStore } from "../services/userProfiles";

const CreateProfileSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
});

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional(),
  settings: z
    .object({
      notificationSounds: z.boolean().optional(),
      autoJoinAudio: z.boolean().optional(),
    })
    .optional(),
});

export function createProfilesRouter(store: UserProfileStore): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({ profiles: store.getAllProfiles() });
  });

  router.get("/:userId", (req, res) => {
    const profile = store.getProfile(req.params.userId);
    if (!profile) {
      res.status(404).json({ code: "not_found", message: "Profile not found" });
      return;
    }
    res.json(profile);
  });

  router.post("/", (req, res) => {
    const parsed = CreateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: "validation_error", issues: parsed.error.issues });
      return;
    }

    const { userId, displayName } = parsed.data;

    const existing = store.getProfile(userId);
    if (existing) {
      res.status(409).json({ code: "conflict", message: "Profile already exists" });
      return;
    }

    const profile = store.createProfile(userId, displayName);
    res.status(201).json(profile);
  });

  router.put("/:userId", (req, res) => {
    const parsed = UpdateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ code: "validation_error", issues: parsed.error.issues });
      return;
    }

    const profile = store.updateProfile(req.params.userId, parsed.data);
    if (!profile) {
      res.status(404).json({ code: "not_found", message: "Profile not found" });
      return;
    }
    res.json(profile);
  });

  return router;
}
