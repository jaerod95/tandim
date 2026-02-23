import express from "express";
import cookieParser from "cookie-parser";
import logger from "morgan";

import apiRouter from "./routes/api";

const app = express();

app.use(logger("dev"));
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
