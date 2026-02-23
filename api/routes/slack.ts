import type { Request, Response } from "express";
import { Router } from "express";
import { buildTandimRoomLink, verifySlackSignature } from "../services/slack";

const router = Router();

router.post("/commands", (req: Request, res: Response) => {
  if (!isValidSlackRequest(req)) {
    res.status(401).json({
      code: "invalid_slack_signature",
      message: "Slack signature validation failed",
      retryable: false
    });
    return;
  }

  const workspaceId = String(req.body.team_id || "unknown");
  const roomId = String(req.body.text || "general").trim() || "general";
  const deepLink = buildTandimRoomLink(workspaceId, roomId);

  res.json({
    response_type: "ephemeral",
    text: `Join room ${roomId}`,
    deep_link: deepLink
  });
});

router.post("/events", (req: Request, res: Response) => {
  if (!isValidSlackRequest(req)) {
    res.status(401).json({
      code: "invalid_slack_signature",
      message: "Slack signature validation failed",
      retryable: false
    });
    return;
  }

  if (req.body?.type === "url_verification" && req.body?.challenge) {
    res.json({ challenge: req.body.challenge });
    return;
  }

  res.status(202).json({ ok: true });
});

function isValidSlackRequest(req: Request): boolean {
  const signingSecret = process.env.SLACK_SIGNING_SECRET || "test-signing-secret";
  const timestampHeader = req.get("x-slack-request-timestamp");
  const signatureHeader = req.get("x-slack-signature");
  const rawBody = req.rawBody ?? "";
  if (!timestampHeader || !signatureHeader || !rawBody) {
    return false;
  }
  return verifySlackSignature({
    signingSecret,
    timestamp: timestampHeader,
    rawBody,
    signatureHeader
  });
}

export default router;
