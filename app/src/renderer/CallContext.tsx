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
