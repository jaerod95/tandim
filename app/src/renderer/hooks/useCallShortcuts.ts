import { useEffect } from "react";
import { useCallContext } from "@/renderer/CallContext";

/**
 * Registers global keyboard shortcuts for call controls.
 *
 * Cmd/Ctrl + D        → toggle mute
 * Cmd/Ctrl + E        → toggle camera
 * Cmd/Ctrl + Shift + S → toggle screen share
 * Cmd/Ctrl + Shift + H → leave call
 */
export function useCallShortcuts() {
  const { engine } = useCallContext();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      switch (e.key.toLowerCase()) {
        case "d":
          if (!e.shiftKey) {
            e.preventDefault();
            engine.toggleMic();
          }
          break;

        case "e":
          if (!e.shiftKey) {
            e.preventDefault();
            void engine.toggleCamera();
          }
          break;

        case "s":
          if (e.shiftKey) {
            e.preventDefault();
            void engine.toggleScreenShare();
          }
          break;

        case "h":
          if (e.shiftKey) {
            e.preventDefault();
            engine.leave();
            window.close();
          }
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [engine]);
}
