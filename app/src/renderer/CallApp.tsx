import CallStage from "./CallStage";
import { CallContextProvider, useCallContext } from "./CallContext";
import CallHeader from "./CallHeader";
import CallFooter from "./CallFooter";
import { useNotificationSounds } from "@/hooks/use-notification-sounds";

function CallAppInner() {
  const { engine } = useCallContext();

  useNotificationSounds({
    presence: engine.presence,
    inCrosstalk: false, // Will be wired up when crosstalk is implemented
    joined: engine.joined,
  });

  return (
    <div className="flex h-screen w-screen flex-col bg-zinc-900 text-zinc-100" style={{ fontSize: 14 }}>
      <CallHeader />
      <CallStage />
      <CallFooter />
    </div>
  );
}

export function CallApp() {
  return (
    <CallContextProvider>
      <CallAppInner />
    </CallContextProvider>
  );
}
