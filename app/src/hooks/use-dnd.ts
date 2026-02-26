import { useState, useEffect, useCallback } from "react";

export function useDnd() {
  const [dndActive, setDndActive] = useState(false);

  useEffect(() => {
    // Listen for DND toggle from tray menu or keyboard shortcut
    window.tandim?.onDndToggle((enabled) => {
      setDndActive(enabled);
    });
  }, []);

  const toggleDnd = useCallback(() => {
    const next = !dndActive;
    setDndActive(next);
    window.tandim?.setDndFromRenderer(next);
  }, [dndActive]);

  const setDnd = useCallback((enabled: boolean) => {
    setDndActive(enabled);
    window.tandim?.setDndFromRenderer(enabled);
  }, []);

  return { dndActive, toggleDnd, setDnd };
}
