import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type SetStateAction,
} from "react";
import type { CallSession } from "./types";

type CallContextValue = {
  currentCall: CallSession | null;
  isLoading: boolean;
  error: string | null;
  setCurrentCall: (next: SetStateAction<CallSession | null>) => void;
  refreshCurrentCall: () => Promise<void>;
};

const CallContext = createContext<CallContextValue | null>(null);

function getSessionIdFromHash(hash: string): string | null {
  const query = hash.includes("?") ? hash.split("?")[1] : "";
  if (!query) {
    return null;
  }

  const sessionId = new URLSearchParams(query).get("sessionId");
  return sessionId && sessionId.length > 0 ? sessionId : null;
}

export function CallContextProvider({ children }: PropsWithChildren) {
  const [currentCall, setCurrentCall] = useState<CallSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshCurrentCall = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const sessionId = getSessionIdFromHash(window.location.hash);
    if (!sessionId) {
      setCurrentCall(null);
      setError("Missing session id");
      setIsLoading(false);
      return;
    }

    const bridge = window.tandem;
    if (!bridge?.getCallSession) {
      setCurrentCall(null);
      setError("Call bridge unavailable");
      setIsLoading(false);
      return;
    }

    try {
      const session = await bridge.getCallSession(sessionId);
      if (!session) {
        setCurrentCall(null);
        setError("Call session not found");
        return;
      }

      setCurrentCall(session);
    } catch (loadError) {
      setCurrentCall(null);
      setError((loadError as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshCurrentCall();
  }, [refreshCurrentCall]);

  const value = useMemo<CallContextValue>(
    () => ({
      currentCall,
      isLoading,
      error,
      setCurrentCall,
      refreshCurrentCall,
    }),
    [currentCall, error, isLoading, refreshCurrentCall],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCallContext(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCallContext must be used within CallContextProvider");
  }
  return context;
}
