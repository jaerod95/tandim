import express from "express";
import cookieParser from "cookie-parser";
import logger from "morgan";

import apiRouter from "./routes/api";
import type { DebugContext } from "./routes/debug";

const app = express();

// Store context for debug routes (will be set by server initialization)
export let debugContext: DebugContext | null = null;
export function setDebugContext(context: DebugContext): void {
  debugContext = context;
}

app.use(logger("dev"));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Slack-Request-Timestamp, X-Slack-Signature");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    }
  })
);
app.use(
  express.urlencoded({
    extended: false,
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString("utf8");
    }
  })
);
app.use(cookieParser());

app.use("/api", apiRouter);

// Debug routes (lazy-loaded to ensure context is available)
app.use("/api/debug", (req, res, next) => {
  if (!debugContext) {
    res.status(503).json({
      code: "debug_not_available",
      message: "Debug context not initialized",
      retryable: true
    });
    return;
  }

  // Lazy-load debug router
  const { createDebugRouter } = require("./routes/debug");
  const debugRouter = createDebugRouter(debugContext);
  debugRouter(req, res, next);
});

app.use("/api/*", (_req, res) => {
  res.status(404).json({
    code: "not_found",
    message: "API route not found",
    retryable: false
  });
});

app.use((_req, res) => {
  res.status(404).json({
    code: "not_found",
    message: "Route not found",
    retryable: false
  });
});

export default app;
