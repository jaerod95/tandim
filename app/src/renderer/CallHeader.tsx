import { useCallContext } from "./CallContext";
import { Users } from "lucide-react";

type StatusStyle = {
  dotClass: string;
  textClass: string;
  animate: boolean;
};

function getStatusStyle(status: string): StatusStyle {
  switch (status) {
    case "Connecting...":
      return { dotClass: "bg-yellow-500", textClass: "text-yellow-500", animate: false };
    case "Connected":
      return { dotClass: "bg-green-500", textClass: "text-green-500", animate: false };
    case "Reconnecting...":
      return { dotClass: "bg-orange-500", textClass: "text-orange-500", animate: true };
    case "Disconnected":
      return { dotClass: "bg-red-500", textClass: "text-red-500", animate: false };
    default:
      // Anything else (error messages like "Microphone access denied") is an error
      return { dotClass: "bg-red-500", textClass: "text-red-400", animate: false };
  }
}

function StatusDot({ status }: { status: string }) {
  const style = getStatusStyle(status);
  return (
    <span className="relative flex h-2 w-2">
      {style.animate && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${style.dotClass}`}
        />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${style.dotClass}`} />
    </span>
  );
}

export default function CallHeader() {
  const { session, isLoading, error, engine } = useCallContext();

  if (isLoading) {
    return (
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-yellow-500" />
        </span>
        <span className="text-sm text-zinc-400">Loading...</span>
      </header>
    );
  }

  if (error) {
    return (
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-zinc-800 px-4">
        <span className="inline-flex h-2 w-2 rounded-full bg-red-500" />
        <span className="text-sm text-red-400">{error}</span>
      </header>
    );
  }

  const peerCount = engine.presence.length;
  const statusStyle = getStatusStyle(engine.status);

  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b border-zinc-800 px-4">
      <span className="text-sm font-medium">{session?.roomId ?? "Call"}</span>
      <span className="flex items-center gap-1.5">
        <StatusDot status={engine.status} />
        <span className={`text-xs ${statusStyle.textClass}`}>{engine.status}</span>
      </span>
      {peerCount > 0 && (
        <span className="ml-auto flex items-center gap-1 text-xs text-zinc-400">
          <Users className="h-3 w-3" />
          {peerCount}
        </span>
      )}
    </header>
  );
}
