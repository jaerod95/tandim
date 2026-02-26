import { useEffect, useRef, useState } from "react";
import { MessageSquare } from "lucide-react";

type CrosstalkVisualState = "in-crosstalk" | "outside-crosstalk" | "none";

type RemoteVideoProps = {
  label: string;
  stream: MediaStream;
  sinkId?: string;
  crosstalkState?: CrosstalkVisualState;
};

export function RemoteVideo({ label, stream, sinkId, crosstalkState = "none" }: RemoteVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    setHasVideo(stream?.getVideoTracks().length > 0);
  }, [stream]);

  useEffect(() => {
    const videoEl = ref.current;
    if (!videoEl || !stream) return;

    videoEl.srcObject = stream;

    const handleAddTrack = (event: MediaStreamTrackEvent) => {
      if (event.track.kind === "video") {
        setHasVideo(true);
        videoEl.load();
      }
    };

    const handleRemoveTrack = (event: MediaStreamTrackEvent) => {
      if (event.track.kind === "video") {
        setHasVideo(false);
      }
    };

    stream.addEventListener("addtrack", handleAddTrack);
    stream.addEventListener("removetrack", handleRemoveTrack);

    return () => {
      stream.removeEventListener("addtrack", handleAddTrack);
      stream.removeEventListener("removetrack", handleRemoveTrack);
    };
  }, [stream, label]);

  // Apply audio output device (sinkId) when it changes
  useEffect(() => {
    const videoEl = ref.current;
    if (!videoEl || !sinkId) return;

    // setSinkId is a Chromium-specific API on HTMLMediaElement
    const el = videoEl as HTMLVideoElement & { setSinkId?: (id: string) => Promise<void> };
    if (typeof el.setSinkId === "function") {
      el.setSinkId(sinkId).catch((err) => {
        console.error("Failed to set audio output device:", err);
      });
    }
  }, [sinkId]);

  const initials = label.charAt(0).toUpperCase();

  const borderClass =
    crosstalkState === "in-crosstalk"
      ? "ring-2 ring-blue-500/60"
      : "";

  const opacityClass =
    crosstalkState === "outside-crosstalk"
      ? "opacity-50"
      : "";

  return (
    <article className={`relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-zinc-800 transition-all duration-200 ${borderClass} ${opacityClass}`}>
      {!hasVideo && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-700 text-xl font-medium text-zinc-300">
            {initials}
          </div>
          <span className="text-xs text-zinc-400">{label}</span>
        </div>
      )}
      {/* Audio is routed through the Web Audio API for per-peer gain control */}
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
        style={{ display: hasVideo ? "block" : "none" }}
      />
      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-xs text-white">
        {label}
        {crosstalkState === "in-crosstalk" && (
          <span className="ml-1 flex items-center gap-0.5 text-blue-300">
            <MessageSquare className="h-3 w-3" />
          </span>
        )}
      </div>
    </article>
  );
}
