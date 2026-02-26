import { useCallback, useState } from "react";
import { useCallContext } from "./CallContext";
import { useCallShortcuts } from "./hooks/useCallShortcuts";
import { useMediaDevices } from "./hooks/useMediaDevices";
import { DeviceMenu } from "./DeviceMenu";
import CrosstalkControls from "./CrosstalkControls";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  PhoneOff,
  Volume2,
  MessageSquare,
} from "lucide-react";

function CrosstalkInviteButton() {
  const { engine, inviteToCrosstalk, outgoingInvitation } = useCallContext();
  const [showMenu, setShowMenu] = useState(false);

  const peers = engine.presence;
  const hasPeers = peers.length > 0;
  const hasPending = outgoingInvitation !== null;

  const handleInvite = (userId: string) => {
    inviteToCrosstalk([userId]);
    setShowMenu(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={!hasPeers || hasPending}
        className={`flex h-9 w-9 items-center justify-center rounded-md transition-colors ${
          hasPending
            ? "bg-indigo-600/20 text-indigo-400"
            : hasPeers
              ? "text-zinc-500 hover:bg-zinc-800"
              : "cursor-not-allowed text-zinc-700"
        }`}
        title={
          hasPending
            ? "Invitation pending..."
            : hasPeers
              ? "Start side conversation"
              : "No peers to invite"
        }
      >
        <MessageSquare className="h-4 w-4" />
      </button>

      {showMenu && (
        <div className="absolute bottom-full left-0 mb-2 w-48 rounded-md border border-zinc-700 bg-zinc-800 py-1 shadow-xl">
          <div className="px-3 py-1.5 text-xs font-medium text-zinc-400">
            Invite to side conversation
          </div>
          {peers.map((peer) => (
            <button
              key={peer.userId}
              onClick={() => handleInvite(peer.userId)}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-200 transition-colors hover:bg-zinc-700"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {peer.displayName}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CallFooter() {
  const { session, engine } = useCallContext();
  useCallShortcuts();
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

      <div className="flex items-center gap-2">
        <CrosstalkControls />
        <CrosstalkInviteButton />
        <button
          onClick={() => void engine.toggleScreenShare()}
          className={`flex h-9 items-center justify-center gap-1.5 rounded-md px-2 transition-colors ${
            engine.screenSharing
              ? "bg-blue-600/20 text-blue-400 hover:bg-blue-600/30"
              : "text-zinc-500 hover:bg-zinc-800"
          }`}
          title={engine.screenSharing ? "Stop sharing" : "Share screen"}
        >
          {engine.screenSharing && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
          )}
          <Monitor className="h-4 w-4" />
          {engine.screenSharing && (
            <span className="text-xs font-medium">Sharing</span>
          )}
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
