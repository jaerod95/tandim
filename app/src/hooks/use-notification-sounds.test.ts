import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { PresenceEntry } from "@/renderer/types";

// Mock the sound functions before importing the hook
vi.mock("@/lib/sounds", () => ({
  playJoinSound: vi.fn(),
  playLeaveSound: vi.fn(),
  playCrosstalkSound: vi.fn(),
}));

import { useNotificationSounds } from "./use-notification-sounds";
import { playJoinSound, playLeaveSound, playCrosstalkSound } from "@/lib/sounds";

function makePeer(userId: string): PresenceEntry {
  return { userId, displayName: userId, state: "connected" };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useNotificationSounds", () => {
  it("does not play sounds when not joined", () => {
    const { rerender } = renderHook(
      (props: { presence: PresenceEntry[] }) =>
        useNotificationSounds({
          presence: props.presence,
          inCrosstalk: false,
          joined: false,
        }),
      { initialProps: { presence: [] } },
    );

    rerender({ presence: [makePeer("alice")] });

    expect(playJoinSound).not.toHaveBeenCalled();
    expect(playLeaveSound).not.toHaveBeenCalled();
  });

  it("does not play sounds on initial join (snapshot phase)", () => {
    renderHook(() =>
      useNotificationSounds({
        presence: [makePeer("alice"), makePeer("bob")],
        inCrosstalk: false,
        joined: true,
      }),
    );

    expect(playJoinSound).not.toHaveBeenCalled();
    expect(playLeaveSound).not.toHaveBeenCalled();
  });

  it("plays join sound when a new peer appears after initial snapshot", () => {
    const { rerender } = renderHook(
      (props: { presence: PresenceEntry[] }) =>
        useNotificationSounds({
          presence: props.presence,
          inCrosstalk: false,
          joined: true,
        }),
      { initialProps: { presence: [makePeer("alice")] } },
    );

    rerender({ presence: [makePeer("alice"), makePeer("bob")] });

    expect(playJoinSound).toHaveBeenCalledTimes(1);
    expect(playLeaveSound).not.toHaveBeenCalled();
  });

  it("plays leave sound when a peer disappears", () => {
    const { rerender } = renderHook(
      (props: { presence: PresenceEntry[] }) =>
        useNotificationSounds({
          presence: props.presence,
          inCrosstalk: false,
          joined: true,
        }),
      { initialProps: { presence: [makePeer("alice"), makePeer("bob")] } },
    );

    rerender({ presence: [makePeer("alice")] });

    expect(playLeaveSound).toHaveBeenCalledTimes(1);
    expect(playJoinSound).not.toHaveBeenCalled();
  });

  it("plays join sound (not leave) when both a join and leave happen simultaneously", () => {
    const { rerender } = renderHook(
      (props: { presence: PresenceEntry[] }) =>
        useNotificationSounds({
          presence: props.presence,
          inCrosstalk: false,
          joined: true,
        }),
      { initialProps: { presence: [makePeer("alice")] } },
    );

    // alice leaves, bob joins — in a single render
    rerender({ presence: [makePeer("bob")] });

    expect(playJoinSound).toHaveBeenCalledTimes(1);
    expect(playLeaveSound).not.toHaveBeenCalled();
  });

  it("plays crosstalk sound when inCrosstalk transitions to true", () => {
    const { rerender } = renderHook(
      (props: { inCrosstalk: boolean }) =>
        useNotificationSounds({
          presence: [makePeer("alice")],
          inCrosstalk: props.inCrosstalk,
          joined: true,
        }),
      { initialProps: { inCrosstalk: false } },
    );

    rerender({ inCrosstalk: true });

    expect(playCrosstalkSound).toHaveBeenCalledTimes(1);
  });

  it("does not play crosstalk sound when inCrosstalk transitions to false", () => {
    const { rerender } = renderHook(
      (props: { inCrosstalk: boolean }) =>
        useNotificationSounds({
          presence: [makePeer("alice")],
          inCrosstalk: props.inCrosstalk,
          joined: true,
        }),
      { initialProps: { inCrosstalk: false } },
    );

    rerender({ inCrosstalk: true });
    vi.clearAllMocks();

    rerender({ inCrosstalk: false });

    expect(playCrosstalkSound).not.toHaveBeenCalled();
  });

  it("does not play any sounds when enabled is false", () => {
    const { rerender } = renderHook(
      (props: { presence: PresenceEntry[] }) =>
        useNotificationSounds({
          presence: props.presence,
          inCrosstalk: false,
          joined: true,
          enabled: false,
        }),
      { initialProps: { presence: [makePeer("alice")] } },
    );

    rerender({ presence: [makePeer("alice"), makePeer("bob")] });

    expect(playJoinSound).not.toHaveBeenCalled();
    expect(playLeaveSound).not.toHaveBeenCalled();
  });

  it("resets state when joined transitions from true to false", () => {
    const { rerender } = renderHook(
      (props: { presence: PresenceEntry[]; joined: boolean }) =>
        useNotificationSounds({
          presence: props.presence,
          inCrosstalk: false,
          joined: props.joined,
        }),
      { initialProps: { presence: [makePeer("alice")], joined: true } },
    );

    // Leave the call
    rerender({ presence: [], joined: false });

    // Re-join with peers already present — should not trigger sounds (snapshot phase)
    rerender({ presence: [makePeer("bob"), makePeer("carol")], joined: true });

    expect(playJoinSound).not.toHaveBeenCalled();
    expect(playLeaveSound).not.toHaveBeenCalled();
  });

  it("plays only one join sound even if multiple peers join at once", () => {
    const { rerender } = renderHook(
      (props: { presence: PresenceEntry[] }) =>
        useNotificationSounds({
          presence: props.presence,
          inCrosstalk: false,
          joined: true,
        }),
      { initialProps: { presence: [] } },
    );

    rerender({ presence: [makePeer("alice"), makePeer("bob"), makePeer("carol")] });

    expect(playJoinSound).toHaveBeenCalledTimes(1);
  });
});
