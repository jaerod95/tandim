import { Volume2 } from "lucide-react";
import { useCallContext } from "./CallContext";

export default function CrosstalkControls() {
  const { session, engine } = useCallContext();
  const { myCrosstalk, outsideVolume, endCrosstalk, setCrosstalkVolume } = engine;

  if (!myCrosstalk) return null;

  return (
    <div className="flex items-center gap-2 rounded-md bg-zinc-800 px-2 py-1">
      <Volume2 className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={outsideVolume}
        onChange={(e) => setCrosstalkVolume(parseFloat(e.target.value))}
        className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-zinc-600 accent-zinc-400 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-zinc-300"
        title="Outside conversation volume"
      />
      <span className="text-[10px] text-zinc-500">{Math.round(outsideVolume * 100)}%</span>
      <button
        onClick={() => endCrosstalk(myCrosstalk.id)}
        className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-zinc-700 hover:text-zinc-200"
      >
        End
      </button>
    </div>
  );
}
