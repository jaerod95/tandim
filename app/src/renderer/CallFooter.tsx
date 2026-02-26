import { useCallback } from "react";
import { useCallContext } from "./CallContext";
import { useMediaDevices } from "./hooks/useMediaDevices";
import { DeviceMenu } from "./DeviceMenu";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Volume2,
} from "lucide-react";

export default function CallFooter() {
  const { session, engine } = useCallContext();
  const { audioInputs, audioOutputs, videoInputs } = useMediaDevices();

  // Determine active device IDs from the current local stream tracks
  const localStream = engine.localStream;
  const activeAudioInputId = localStream
    ?.getAudioTracks()[0]
    ?.getSettings()?.deviceId;
  const activeVideoInputId = localStream
    ?.getVideoTracks()[0]
    ?.getSettings()?.deviceId;

  const handleAudioInputSelect = useCallback(
    (deviceId: string) => {
      void engine.switchAudioDevice(deviceId);
    },
    [engine],
  );

  const handleVideoInputSelect = useCallback(
    (deviceId: string) => {
      void engine.switchVideoDevice(deviceId);
    },
    [engine],
  );

  const handleAudioOutputSelect = useCallback(
    (deviceId: string) => {
      engine.setSinkId(deviceId);
    },
    [engine],
  );

  return (
    <footer className="flex h-14 shrink-0 items-center justify-between border-t border-zinc-800 px-4">
      <div className="flex items-center gap-1">
        {/* Mic button + device picker */}
        <div className="flex items-center">
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
          <DeviceMenu
            devices={audioInputs}
            activeDeviceId={activeAudioInputId}
            onSelect={handleAudioInputSelect}
          />
        </div>

        {/* Camera button + device picker */}
        <div className="flex items-center">
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
          <DeviceMenu
            devices={videoInputs}
            activeDeviceId={activeVideoInputId}
            onSelect={handleVideoInputSelect}
          />
        </div>

        {/* Audio output picker */}
        {audioOutputs.length > 0 && (
          <div className="flex items-center">
            <div className="flex h-9 w-9 items-center justify-center text-zinc-500">
              <Volume2 className="h-4 w-4" />
            </div>
            <DeviceMenu
              devices={audioOutputs}
              activeDeviceId={engine.sinkId || undefined}
              onSelect={handleAudioOutputSelect}
            />
          </div>
        )}
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
