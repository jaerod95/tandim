import { useCallContext } from "./CallContext";
import { Users, MessageSquare, X } from "lucide-react";

function CrosstalkBanner() {
  const { session, engine } = useCallContext();
  const { activeCrosstalks, myCrosstalk, presence, endCrosstalk } = engine;

  if (activeCrosstalks.length === 0) return null;

  if (myCrosstalk) {
    const otherParticipants = myCrosstalk.participantUserIds
      .filter((id) => id !== session?.userId)
      .map((id) => presence.find((p) => p.userId === id)?.displayName ?? id);

    const names = otherParticipants.join(", ");

    return (
      <div className="flex items-center gap-2 border-b border-blue-500/20 bg-blue-600/10 px-4 py-1.5">
        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-blue-400" />
        <span className="text-xs text-blue-300">
          In crosstalk with {names}
        </span>
        <button
          onClick={() => endCrosstalk(myCrosstalk.id)}
          className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-blue-400 transition-colors hover:bg-blue-600/20 hover:text-blue-300"
        >
          <X className="h-3 w-3" />
          End
        </button>
      </div>
    );
  }

  // Local user is NOT in a crosstalk, but others are
  const otherCrosstalk = activeCrosstalks[0];
  const participantNames = otherCrosstalk.participantUserIds
    .map((id) => presence.find((p) => p.userId === id)?.displayName ?? id);

  const label =
    participantNames.length === 2
      ? `${participantNames[0]} and ${participantNames[1]} are in a crosstalk`
      : `${participantNames.join(", ")} are in a crosstalk`;

  return (
    <div className="flex items-center gap-2 border-b border-zinc-700/50 bg-zinc-800/50 px-4 py-1.5">
      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
      <span className="text-xs text-zinc-400">{label}</span>
    </div>
  );
}

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
    <div className="shrink-0">
      <header className="flex h-10 items-center gap-3 border-b border-zinc-800 px-4">
        <span className="text-sm font-medium">{session?.roomId ?? "Call"}</span>
        <span className="text-xs text-zinc-500">{engine.status}</span>
        {peerCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-zinc-400">
            <Users className="h-3 w-3" />
            {peerCount}
          </span>
        )}
      </header>
      <CrosstalkBanner />
    </div>
  );
}
