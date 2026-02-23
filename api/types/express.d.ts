import "express-serve-static-core";
import { IncomingMessage } from "http";

declare module "express-serve-static-core" {
  interface Request {
    rawBody?: string;
  }
}

declare module "http" {
  interface IncomingMessage {
    rawBody?: string;
  }
}
