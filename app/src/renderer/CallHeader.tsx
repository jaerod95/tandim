import { useCallContext } from "./CallContext";
import { Users, Monitor } from "lucide-react";

export default function CallHeader() {
  const { session, isLoading, error, engine } = useCallContext();

  if (isLoading) {
    return (
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
        <span className="text-sm text-zinc-400">Connecting...</span>
      </header>
    );
  }

  if (error) {
    return (
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
        <span className="text-sm text-red-400">{error}</span>
      </header>
    );
  }

  const peerCount = engine.presence.length;

  // Determine the screen share banner text
  let screenShareLabel: string | null = null;
  if (engine.screenSharing) {
    screenShareLabel = "You are sharing your screen";
  } else if (engine.activeScreenSharerUserId) {
    const sharer = engine.presence.find((p) => p.userId === engine.activeScreenSharerUserId);
    const sharerName = sharer?.displayName ?? engine.activeScreenSharerUserId;
    screenShareLabel = `${sharerName} is sharing their screen`;
  }

  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b border-zinc-800 px-4">
      <span className="text-sm font-medium">{session?.roomId ?? "Call"}</span>
      <span className="text-xs text-zinc-500">{engine.status}</span>
      {screenShareLabel && (
        <span className="flex items-center gap-1.5 rounded bg-blue-600/20 px-2 py-0.5 text-xs text-blue-400">
          <Monitor className="h-3 w-3" />
          {screenShareLabel}
        </span>
      )}
      {peerCount > 0 && (
        <span className="ml-auto flex items-center gap-1 text-xs text-zinc-400">
          <Users className="h-3 w-3" />
          {peerCount}
        </span>
      )}
    </header>
  );
}
