import { useEffect, useRef } from "react";

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

type UseIdleDetectorOptions = {
  onIdle: () => void;
  onActive: () => void;
  timeoutMs?: number;
};

export function useIdleDetector({
  onIdle,
  onActive,
  timeoutMs = IDLE_TIMEOUT_MS,
}: UseIdleDetectorOptions): void {
  const isIdleRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const resetTimer = () => {
      if (isIdleRef.current) {
        isIdleRef.current = false;
        onActive();
      }
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        isIdleRef.current = true;
        onIdle();
      }, timeoutMs);
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    for (const event of events) {
      window.addEventListener(event, resetTimer, { passive: true });
    }

    // Start the initial timer
    resetTimer();

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      for (const event of events) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [onIdle, onActive, timeoutMs]);
}
