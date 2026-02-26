import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import type { CallSession } from "./types";
import { useCallEngine, type UseCallEngineReturn } from "./hooks/useCallEngine";

type CallContextValue = {
  session: CallSession | null;
  isLoading: boolean;
  error: string | null;
  engine: UseCallEngineReturn;
};

const CallContext = createContext<CallContextValue | null>(null);

function getSessionIdFromHash(hash: string): string | null {
  const query = hash.includes("?") ? hash.split("?")[1] : "";
  if (!query) return null;
  const sessionId = new URLSearchParams(query).get("sessionId");
  return sessionId && sessionId.length > 0 ? sessionId : null;
}

export function CallContextProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<CallSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sessionId = getSessionIdFromHash(window.location.hash);
    if (!sessionId) {
      setError("No session ID in URL");
      setIsLoading(false);
      return;
    }

    window.tandim?.getCallSession(sessionId).then((result) => {
      if (result) {
        setSession(result);
      } else {
        setError("Session not found");
      }
      setIsLoading(false);
    });
  }, []);

  const engine = useCallEngine(session);

  // Safety net: clean up if window is closed without unmounting
  useEffect(() => {
    const handleBeforeUnload = () => {
      engine.leave();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [engine]);

  const value: CallContextValue = {
    session,
    isLoading,
    error,
    engine,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}

export function useCallContext(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCallContext must be used within CallContextProvider");
  }
  return context;
}
