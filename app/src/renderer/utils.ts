import type { PresenceEntry, RemoteTile } from "./types";

export function upsertPresence(current: PresenceEntry[], next: PresenceEntry): PresenceEntry[] {
  const map = new Map(current.map((entry) => [entry.userId, entry]));
  map.set(next.userId, next);
  return Array.from(map.values());
}

export function upsertRemoteTile(current: RemoteTile[], next: RemoteTile): RemoteTile[] {
  const map = new Map(current.map((entry) => [entry.userId, entry]));
  map.set(next.userId, next);
  return Array.from(map.values());
}
