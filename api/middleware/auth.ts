import type { Request, Response, NextFunction } from "express";
import { verifyToken, type TokenPayload } from "../services/auth";

declare module "express-serve-static-core" {
  interface Request {
    user?: TokenPayload;
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7);
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ code: "unauthorized", message: "Missing auth token" });
    return;
  }

  const user = verifyToken(token);
  if (!user) {
    res.status(401).json({ code: "unauthorized", message: "Invalid or expired token" });
    return;
  }

  req.user = user;
  next();
}

export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }
  next();
}
