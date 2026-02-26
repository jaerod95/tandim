import { useCallContext } from "./CallContext";
import { Users } from "lucide-react";

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

  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b border-zinc-800 px-4">
      <span className="text-sm font-medium">{session?.roomId ?? "Call"}</span>
      <span className="text-xs text-zinc-500">{engine.status}</span>
      {peerCount > 0 && (
        <span className="ml-auto flex items-center gap-1 text-xs text-zinc-400">
          <Users className="h-3 w-3" />
          {peerCount}
        </span>
      )}
    </header>
  );
}
