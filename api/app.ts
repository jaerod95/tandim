import express from "express";
import cookieParser from "cookie-parser";
import logger from "morgan";

import apiRouter from "./routes/api";
import debugRouter from "./routes/debug";
import slackRouter from "./routes/slack";

const app = express();

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
app.use('/api/debug', debugRouter);
app.use('/api/slack', slackRouter);

// Error handling
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
