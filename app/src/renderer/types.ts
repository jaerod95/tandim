export type SignalPeer = { userId: string; displayName: string };
export type IceConfig = { iceServers: RTCIceServer[] };
export type PresenceEntry = { userId: string; displayName: string; state: "you" | "connected" };
export type RemoteTile = { userId: string; displayName: string; stream: MediaStream };
export type CallSession = {
  apiUrl: string;
  workspaceId: string;
  roomId: string;
  displayName: string;
  userId: string;
};

export const ROOMS = [
  "Team Standup",
  "Lounge",
  "Meeting Room",
  "Help Needed",
  "Coffee Break",
  "Library - Co-Working"
];
