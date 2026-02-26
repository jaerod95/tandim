import CallStage from "./CallStage";
import { CallContextProvider } from "./CallContext";
import CallHeader from "./CallHeader";
import CallFooter from "./CallFooter";

export function CallApp() {
  return (
    <CallContextProvider>
      <div className="flex h-screen w-screen flex-col bg-zinc-900 text-zinc-100" style={{ fontSize: 14 }}>
        <CallHeader />
        <CallStage />
        <CallFooter />
      </div>
    </CallContextProvider>
  );
}
