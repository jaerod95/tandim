export type SignalPeer = { userId: string; displayName: string };
export type IceConfig = { iceServers: RTCIceServer[] };
export type PresenceEntry = {
  userId: string;
  displayName: string;
  state: "you" | "connected";
};
export type RemoteTile = {
  userId: string;
  displayName: string;
  stream: MediaStream;
  version: number;
};
export type CallSession = {
  apiUrl: string;
  workspaceId: string;
  roomId: string;
  displayName: string;
  userId: string;
};

export const ROOMS = [
  { name: "Team Standup", emoji: "👥" },
  { name: "Lounge", emoji: "🏖️" },
  { name: "Meeting Room", emoji: "📋" },
  { name: "Help Needed", emoji: "⚡" },
  { name: "Coffee Break", emoji: "☕" },
  { name: "Library - Co-Working", emoji: "📚" },
];
