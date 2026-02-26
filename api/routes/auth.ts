import { Router } from "express";
import { z } from "zod";
import {
  registerUser,
  authenticateUser,
  generateToken,
} from "../services/auth";
import { requireAuth } from "../middleware/auth";

const authRouter = Router();

const credentialsSchema = z.object({
  displayName: z.string().min(1).max(50),
  password: z.string().min(4).max(128),
});

authRouter.post("/register", (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      code: "validation_error",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    });
    return;
  }

  const { displayName, password } = parsed.data;

  try {
    const user = registerUser(displayName, password);
    const token = generateToken(user);
    res.status(201).json({ token, user });
  } catch (err) {
    if (err instanceof Error && err.message === "User already exists") {
      res.status(409).json({ code: "user_exists", message: "User already exists" });
      return;
    }
    throw err;
  }
});

authRouter.post("/login", (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      code: "validation_error",
      message: parsed.error.issues.map((i) => i.message).join(", "),
    });
    return;
  }

  const { displayName, password } = parsed.data;
  const user = authenticateUser(displayName, password);

  if (!user) {
    res.status(401).json({ code: "invalid_credentials", message: "Invalid display name or password" });
    return;
  }

  const token = generateToken(user);
  res.json({ token, user });
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default authRouter;
