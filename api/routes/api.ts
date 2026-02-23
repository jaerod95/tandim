import { Router } from "express";
import { getIceConfigFromEnv } from "../services/iceConfig";
import slackRouter from "./slack";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "api"
  });
});

router.get("/ice-config", (_req, res) => {
  res.json(getIceConfigFromEnv(process.env));
});
router.use("/slack", slackRouter);

export default router;
