import { useCallback, useEffect, useRef, useState } from "react";
import { useCallContext } from "./CallContext";
import { RemoteVideo } from "./RemoteVideo";
import { Monitor, Maximize, Minimize, Expand, Shrink } from "lucide-react";

function LocalVideoPreview({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="absolute bottom-4 right-4 h-32 w-44 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-lg">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function ScreenShareView({ stream, label }: { stream: MediaStream; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [objectFit, setObjectFit] = useState<"contain" | "cover">("contain");
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Listen for fullscreen change (user may exit via Esc key)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await containerRef.current.requestFullscreen();
      }
    } catch (err) {
      console.error("Fullscreen toggle failed:", err);
    }
  }, []);

  const toggleFit = useCallback(() => {
    setObjectFit((prev) => (prev === "contain" ? "cover" : "contain"));
  }, []);

  return (
    <div
      ref={containerRef}
      className="group relative flex-1 overflow-hidden rounded-lg bg-black"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className={`h-full w-full ${objectFit === "contain" ? "object-contain" : "object-cover"}`}
      />
      {/* Label */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-1 text-xs text-white">
        <Monitor className="h-3 w-3" />
        {label}&apos;s screen
      </div>
      {/* Viewer controls — appear on hover */}
      <div
        className={`absolute right-2 top-2 flex items-center gap-1 transition-opacity duration-200 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          onClick={toggleFit}
          className="flex h-8 w-8 items-center justify-center rounded bg-black/60 text-white transition-colors hover:bg-black/80"
          title={objectFit === "contain" ? "Fill (crop to fit)" : "Fit (show all)"}
        >
          {objectFit === "contain" ? <Expand className="h-4 w-4" /> : <Shrink className="h-4 w-4" />}
        </button>
        <button
          onClick={() => void toggleFullscreen()}
          className="flex h-8 w-8 items-center justify-center rounded bg-black/60 text-white transition-colors hover:bg-black/80"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function EmptyStage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 text-zinc-500">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800 text-2xl">
        🎧
      </div>
      <p className="text-sm">Waiting for others to join...</p>
    </div>
  );
}

export default function CallStage() {
  const { engine } = useCallContext();

  const { remoteTiles, screenShareTile, localStream, cameraEnabled, activeScreenSharerUserId, screenSharing } = engine;

  // Screen share active — show focused layout
  if (activeScreenSharerUserId && screenShareTile) {
    return (
      <section className="relative flex flex-1 flex-col gap-3 overflow-hidden p-4">
        <ScreenShareView
          stream={screenShareTile.stream}
          label={screenShareTile.displayName}
        />
        {/* Camera tiles strip at bottom */}
        {remoteTiles.length > 0 && (
          <div className="flex h-28 shrink-0 gap-2 overflow-x-auto">
            {remoteTiles.map((tile) => (
              <div key={tile.userId} className="h-full w-40 shrink-0">
                <RemoteVideo label={tile.displayName} stream={tile.stream} />
              </div>
            ))}
          </div>
        )}
        {cameraEnabled && localStream && (
          <LocalVideoPreview stream={localStream} />
        )}
      </section>
    );
  }

  // Local user is sharing — show indicator + normal grid
  if (screenSharing) {
    return (
      <section className="relative flex flex-1 flex-col items-center justify-center gap-3 p-4">
        <div className="flex items-center gap-2 rounded-lg bg-blue-600/20 px-3 py-2 text-sm text-blue-400">
          <Monitor className="h-4 w-4" />
          You are sharing your screen
        </div>
        {remoteTiles.length === 0 ? (
          <EmptyStage />
        ) : (
          <div className="grid auto-rows-fr gap-3" style={{
            gridTemplateColumns: `repeat(${Math.min(remoteTiles.length, 3)}, minmax(0, 1fr))`,
          }}>
            {remoteTiles.map((tile) => (
              <RemoteVideo
                key={tile.userId}
                label={tile.displayName}
                stream={tile.stream}
              />
            ))}
          </div>
        )}
        {cameraEnabled && localStream && (
          <LocalVideoPreview stream={localStream} />
        )}
      </section>
    );
  }

  // Normal grid layout
  return (
    <section className="relative flex flex-1 items-center justify-center gap-3 p-4">
      {remoteTiles.length === 0 ? (
        <EmptyStage />
      ) : (
        <div className="grid auto-rows-fr gap-3" style={{
          gridTemplateColumns: `repeat(${Math.min(remoteTiles.length, 3)}, minmax(0, 1fr))`,
        }}>
          {remoteTiles.map((tile) => (
            <RemoteVideo
              key={tile.userId}
              label={tile.displayName}
              stream={tile.stream}
            />
          ))}
        </div>
      )}
      {cameraEnabled && localStream && (
        <LocalVideoPreview stream={localStream} />
      )}
    </section>
  );
}
