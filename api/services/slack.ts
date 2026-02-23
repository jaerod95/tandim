import crypto from "node:crypto";

export function buildTandimRoomLink(workspaceId: string, roomId: string): string {
  return `tandim://room/${encodeURIComponent(workspaceId)}-${encodeURIComponent(roomId)}`;
}

export function verifySlackSignature(input: {
  signingSecret: string;
  timestamp: string;
  rawBody: string;
  signatureHeader: string;
}): boolean {
  const base = `v0:${input.timestamp}:${input.rawBody}`;
  const expected =
    "v0=" +
    crypto.createHmac("sha256", input.signingSecret).update(base, "utf8").digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(input.signatureHeader, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
