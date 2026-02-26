import { useCallContext } from "./CallContext";
import { useCallShortcuts } from "./hooks/useCallShortcuts";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
} from "lucide-react";

export default function CallFooter() {
  const { session, engine } = useCallContext();
  useCallShortcuts();

  return (
    <footer className="flex h-14 shrink-0 items-center justify-between border-t border-zinc-800 px-4">
      <div className="flex items-center gap-1">
        <button
          onClick={engine.toggleMic}
          className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
            engine.micEnabled
              ? "text-zinc-300 hover:bg-zinc-800"
              : "bg-red-600/20 text-red-400 hover:bg-red-600/30"
          }`}
          title={engine.micEnabled ? "Mute" : "Unmute"}
        >
          {engine.micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
        </button>
        <button
          onClick={() => void engine.toggleCamera()}
          className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
            engine.cameraEnabled
              ? "text-zinc-300 hover:bg-zinc-800"
              : "text-zinc-500 hover:bg-zinc-800"
          }`}
          title={engine.cameraEnabled ? "Turn off camera" : "Turn on camera"}
        >
          {engine.cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => void engine.toggleScreenShare()}
          className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
            engine.screenSharing
              ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
              : "text-zinc-500 hover:bg-zinc-800"
          }`}
          title={engine.screenSharing ? "Stop sharing" : "Share screen"}
        >
          <Monitor className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">{session?.displayName}</span>
        <button
          onClick={() => {
            engine.leave();
            window.close();
          }}
          className="flex h-9 items-center gap-1.5 rounded-md bg-red-600 px-3 text-sm font-medium text-white transition-colors hover:bg-red-700"
          title="Leave call"
        >
          <PhoneOff className="h-4 w-4" />
          Leave
        </button>
      </div>
    </footer>
  );
}
