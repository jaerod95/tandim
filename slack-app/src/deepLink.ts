export function buildDesktopRoomDeepLink(roomId: string): string {
  return `tandim://room/${encodeURIComponent(roomId)}`;
}
