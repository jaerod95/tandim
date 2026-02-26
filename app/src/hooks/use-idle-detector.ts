import { useEffect, useRef } from "react";

type UseIdleDetectorOptions = {
  onIdle: () => void;
  onActive: () => void;
};

/**
 * Listens for OS-level idle state changes from the Electron main process
 * via powerMonitor. Falls back to a no-op if the IPC bridge is unavailable
 * (e.g., in a browser or test environment).
 */
export function useIdleDetector({ onIdle, onActive }: UseIdleDetectorOptions): void {
  const onIdleRef = useRef(onIdle);
  const onActiveRef = useRef(onActive);

  useEffect(() => {
    onIdleRef.current = onIdle;
    onActiveRef.current = onActive;
  }, [onIdle, onActive]);

  useEffect(() => {
    window.tandim?.onIdleStateChanged((isIdle) => {
      if (isIdle) {
        onIdleRef.current();
      } else {
        onActiveRef.current();
      }
    });
  }, []);
}
