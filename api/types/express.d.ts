import "express-serve-static-core";
import { IncomingMessage } from "http";
import type { TokenPayload } from "../services/auth";

declare module "express-serve-static-core" {
  interface Request {
    rawBody?: string;
    user?: TokenPayload;
  }
}

declare module "http" {
  interface IncomingMessage {
    rawBody?: string;
  }
}
