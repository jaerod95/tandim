import { useEffect, useRef } from "react";
import { playJoinSound, playLeaveSound, playCrosstalkSound } from "@/lib/sounds";
import type { PresenceEntry } from "@/renderer/types";

type UseNotificationSoundsOptions = {
  /** Current peers in the room (excluding self) */
  presence: PresenceEntry[];
  /** Whether the local user is currently in a crosstalk */
  inCrosstalk: boolean;
  /** Whether the user has joined the call (skip sounds during initial load) */
  joined: boolean;
  /** Master toggle — set to false to mute all notification sounds */
  enabled?: boolean;
};

/**
 * Plays notification sounds when peers join/leave or crosstalk starts.
 * Skips sounds during initial join to avoid a burst of notifications.
 */
export function useNotificationSounds({
  presence,
  inCrosstalk,
  joined,
  enabled = true,
}: UseNotificationSoundsOptions): void {
  const prevPeerIdsRef = useRef<Set<string> | null>(null);
  const prevCrosstalkRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!joined || !enabled) {
      // Reset when not in a call so re-joining doesn't replay stale diffs
      prevPeerIdsRef.current = null;
      initializedRef.current = false;
      prevCrosstalkRef.current = false;
      return;
    }

    const currentIds = new Set(presence.map((p) => p.userId));

    if (!initializedRef.current) {
      // First render after join — snapshot without playing sounds
      prevPeerIdsRef.current = currentIds;
      prevCrosstalkRef.current = inCrosstalk;
      initializedRef.current = true;
      return;
    }

    const prevIds = prevPeerIdsRef.current ?? new Set<string>();

    // Detect joins
    for (const id of currentIds) {
      if (!prevIds.has(id)) {
        playJoinSound();
        break; // One sound per batch is enough
      }
    }

    // Detect leaves (only if nobody joined — avoid overlapping sounds)
    let anyJoined = false;
    for (const id of currentIds) {
      if (!prevIds.has(id)) {
        anyJoined = true;
        break;
      }
    }
    if (!anyJoined) {
      for (const id of prevIds) {
        if (!currentIds.has(id)) {
          playLeaveSound();
          break;
        }
      }
    }

    prevPeerIdsRef.current = currentIds;
  }, [presence, joined, enabled]);

  // Crosstalk tracked separately so peer changes don't mask it
  useEffect(() => {
    if (!joined || !enabled || !initializedRef.current) return;

    if (inCrosstalk && !prevCrosstalkRef.current) {
      playCrosstalkSound();
    }
    prevCrosstalkRef.current = inCrosstalk;
  }, [inCrosstalk, joined, enabled]);
}
