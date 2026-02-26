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
  audioEnabled: boolean;
  apiUrl: string;
  workspaceId: string;
  roomId: string;
  displayName: string;
  userId: string;
  token?: string;
};

export type Crosstalk = {
  id: string;
  initiatorUserId: string;
  participantUserIds: string[];
};

export type Room = {
  id: string;
  name: string;
  emoji: string;
};

export const DEFAULT_ROOMS: Room[] = [
  { id: "team-standup", name: "Team Standup", emoji: "\u{1F465}" },
  { id: "lounge", name: "Lounge", emoji: "\u{1F3D6}\uFE0F" },
  { id: "meeting-room", name: "Meeting Room", emoji: "\u{1F4CB}" },
  { id: "help-needed", name: "Help Needed", emoji: "\u26A1" },
  { id: "coffee-break", name: "Coffee Break", emoji: "\u2615" },
  { id: "library-co-working", name: "Library - Co-Working", emoji: "\u{1F4DA}" },
];

/** @deprecated Use DEFAULT_ROOMS and the Room type instead */
export const ROOMS = DEFAULT_ROOMS;
