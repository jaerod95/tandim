export type DeepLinkRoute =
  | { type: "join-room"; roomId: string; workspaceId?: string }
  | { type: "view-room"; roomId: string; workspaceId?: string }
  | { type: "workspace"; workspaceId: string }
  | { type: "unknown" };

/**
 * Parse a tandim:// deep link URL into a typed route.
 *
 * Supported patterns:
 *   tandim://join/<roomId>                         -> join-room
 *   tandim://room/<roomId>                         -> view-room
 *   tandim://workspace/<workspaceId>               -> workspace
 *   tandim://workspace/<workspaceId>/room/<roomId> -> view-room (with workspace)
 *   tandim://workspace/<workspaceId>/join/<roomId> -> join-room (with workspace)
 */
export function parseTandemDeepLink(input: string): DeepLinkRoute {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input);
  } catch {
    return { type: "unknown" };
  }

  if (parsedUrl.protocol !== "tandim:") {
    return { type: "unknown" };
  }

  // URL class treats tandim://join/abc as hostname="join", pathname="/abc"
  // Normalize into a single path string with no leading/trailing slashes
  const path = `${parsedUrl.hostname}${parsedUrl.pathname}`
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { type: "unknown" };
  }

  // tandim://join/<roomId>
  if (segments[0] === "join" && segments.length === 2) {
    return { type: "join-room", roomId: segments[1] };
  }

  // tandim://room/<roomId>
  if (segments[0] === "room" && segments.length === 2) {
    return { type: "view-room", roomId: segments[1] };
  }

  // tandim://workspace/<workspaceId>
  // tandim://workspace/<workspaceId>/room/<roomId>
  // tandim://workspace/<workspaceId>/join/<roomId>
  if (segments[0] === "workspace" && segments.length >= 2) {
    const workspaceId = segments[1];

    if (segments.length === 2) {
      return { type: "workspace", workspaceId };
    }

    if (segments.length === 4 && segments[2] === "room") {
      return { type: "view-room", roomId: segments[3], workspaceId };
    }

    if (segments.length === 4 && segments[2] === "join") {
      return { type: "join-room", roomId: segments[3], workspaceId };
    }
  }

  return { type: "unknown" };
}
