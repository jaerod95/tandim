const ROOM_PATH_PREFIX = "room/";

export type DeepLinkRoute =
  | { type: "room"; roomId: string }
  | { type: "invalid"; reason: string };

export function parseTandemDeepLink(input: string): DeepLinkRoute {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input);
  } catch {
    return { type: "invalid", reason: "malformed_url" };
  }

  if (parsedUrl.protocol !== "tandim:") {
    return { type: "invalid", reason: "unsupported_protocol" };
  }

  const path = `${parsedUrl.hostname}${parsedUrl.pathname}`.replace(/^\/+/, "");
  if (!path.startsWith(ROOM_PATH_PREFIX)) {
    return { type: "invalid", reason: "unsupported_route" };
  }

  const roomId = path.slice(ROOM_PATH_PREFIX.length).trim();
  if (!roomId) {
    return { type: "invalid", reason: "missing_room_id" };
  }

  return { type: "room", roomId };
}
