import React, { useCallback, useEffect, useState } from "react";

type UpdateState =
  | { status: "idle" }
  | { status: "downloading" }
  | { status: "ready"; version: string };

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });

  useEffect(() => {
    window.tandim?.onUpdateAvailable(() => {
      setState({ status: "downloading" });
    });

    window.tandim?.onUpdateDownloaded((info) => {
      setState({ status: "ready", version: info.version });
    });
  }, []);

  const dismiss = useCallback(() => setState({ status: "idle" }), []);

  const install = useCallback(() => {
    window.tandim?.installUpdate();
  }, []);

  if (state.status === "idle") return null;

  if (state.status === "ready") {
    return (
      <div className="flex items-center justify-between border-b border-emerald-900/50 bg-emerald-950/50 px-4 py-2 text-xs text-emerald-400">
        <span>Update ready (v{state.version}) — restart to install</span>
        <div className="flex gap-2">
          <button
            onClick={install}
            className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white hover:bg-emerald-500"
          >
            Restart
          </button>
          <button
            onClick={dismiss}
            className="text-emerald-500 hover:text-emerald-300"
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  // status === "downloading"
  return (
    <div className="flex items-center justify-between border-b border-blue-900/50 bg-blue-950/50 px-4 py-2 text-xs text-blue-400">
      <span>Downloading update...</span>
      <button
        onClick={dismiss}
        className="text-blue-500 hover:text-blue-300"
      >
        Dismiss
      </button>
    </div>
  );
}
