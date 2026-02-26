import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type PropsWithChildren,
} from "react";
import type { CallSession } from "./types";
import { useCallEngine, type UseCallEngineReturn } from "./hooks/useCallEngine";

export type PendingCrosstalkInvitation = {
  invitationId: string;
  inviterUserId: string;
  inviterDisplayName: string;
  roomId: string;
  receivedAt: number;
};

type OutgoingCrosstalkInvitation = {
  invitationId: string;
  targetUserIds: string[];
  acceptedUserIds: string[];
};

type CallContextValue = {
  session: CallSession | null;
  isLoading: boolean;
  error: string | null;
  engine: UseCallEngineReturn;
  pendingInvitations: PendingCrosstalkInvitation[];
  outgoingInvitation: OutgoingCrosstalkInvitation | null;
  inviteToCrosstalk: (targetUserIds: string[]) => void;
  acceptInvitation: (invitationId: string) => void;
  declineInvitation: (invitationId: string) => void;
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
  const [pendingInvitations, setPendingInvitations] = useState<
    PendingCrosstalkInvitation[]
  >([]);
  const [outgoingInvitation, setOutgoingInvitation] =
    useState<OutgoingCrosstalkInvitation | null>(null);

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

  // Listen for crosstalk invitation events from the engine's socket
  useEffect(() => {
    const socket = engine.getSocket?.();
    if (!socket || !session) return;

    const handleInvited = (data: {
      invitationId: string;
      inviterUserId: string;
      inviterDisplayName: string;
      roomId: string;
    }) => {
      setPendingInvitations((prev) => [
        ...prev,
        { ...data, receivedAt: Date.now() },
      ]);
    };

    const handleInviteSent = (data: {
      invitationId: string;
      targetUserIds: string[];
    }) => {
      setOutgoingInvitation({
        invitationId: data.invitationId,
        targetUserIds: data.targetUserIds,
        acceptedUserIds: [],
      });
    };

    const handleAccepted = (data: {
      invitationId: string;
      userId: string;
    }) => {
      setOutgoingInvitation((prev) => {
        if (!prev || prev.invitationId !== data.invitationId) return prev;
        return {
          ...prev,
          acceptedUserIds: [...prev.acceptedUserIds, data.userId],
        };
      });
    };

    const handleDeclined = (data: {
      invitationId: string;
      userId: string;
    }) => {
      setOutgoingInvitation((prev) => {
        if (!prev || prev.invitationId !== data.invitationId) return prev;
        return {
          ...prev,
          targetUserIds: prev.targetUserIds.filter((id) => id !== data.userId),
        };
      });
    };

    const handleExpired = (data: { invitationId: string }) => {
      setPendingInvitations((prev) =>
        prev.filter((inv) => inv.invitationId !== data.invitationId)
      );
      setOutgoingInvitation((prev) => {
        if (!prev || prev.invitationId !== data.invitationId) return prev;
        return null;
      });
    };

    const handleStarted = (data: {
      invitationId: string;
      participantUserIds: string[];
    }) => {
      setPendingInvitations((prev) =>
        prev.filter((inv) => inv.invitationId !== data.invitationId)
      );
      setOutgoingInvitation((prev) => {
        if (!prev || prev.invitationId !== data.invitationId) return prev;
        return null;
      });
    };

    socket.on("signal:crosstalk-invited", handleInvited);
    socket.on("signal:crosstalk-invite-sent", handleInviteSent);
    socket.on("signal:crosstalk-invite-accepted", handleAccepted);
    socket.on("signal:crosstalk-invite-declined", handleDeclined);
    socket.on("signal:crosstalk-invite-expired", handleExpired);
    socket.on("signal:crosstalk-started", handleStarted);

    return () => {
      socket.off("signal:crosstalk-invited", handleInvited);
      socket.off("signal:crosstalk-invite-sent", handleInviteSent);
      socket.off("signal:crosstalk-invite-accepted", handleAccepted);
      socket.off("signal:crosstalk-invite-declined", handleDeclined);
      socket.off("signal:crosstalk-invite-expired", handleExpired);
      socket.off("signal:crosstalk-started", handleStarted);
    };
  }, [engine.getSocket, session]);

  // Auto-dismiss expired pending invitations (30s client-side timeout)
  useEffect(() => {
    if (pendingInvitations.length === 0) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setPendingInvitations((prev) =>
        prev.filter((inv) => now - inv.receivedAt < 30_000)
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingInvitations.length]);

  const inviteToCrosstalk = useCallback(
    (targetUserIds: string[]) => {
      const socket = engine.getSocket?.();
      if (!socket || !session) return;
      socket.emit("signal:crosstalk-invite", {
        workspaceId: session.workspaceId,
        roomId: session.roomId,
        targetUserIds,
      });
    },
    [engine.getSocket, session]
  );

  const acceptInvitation = useCallback(
    (invitationId: string) => {
      const socket = engine.getSocket?.();
      if (!socket || !session) return;
      socket.emit("signal:crosstalk-invite-accept", {
        workspaceId: session.workspaceId,
        roomId: session.roomId,
        invitationId,
      });
      setPendingInvitations((prev) =>
        prev.filter((inv) => inv.invitationId !== invitationId)
      );
    },
    [engine.getSocket, session]
  );

  const declineInvitation = useCallback(
    (invitationId: string) => {
      const socket = engine.getSocket?.();
      if (!socket || !session) return;
      socket.emit("signal:crosstalk-invite-decline", {
        workspaceId: session.workspaceId,
        roomId: session.roomId,
        invitationId,
      });
      setPendingInvitations((prev) =>
        prev.filter((inv) => inv.invitationId !== invitationId)
      );
    },
    [engine.getSocket, session]
  );

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
    pendingInvitations,
    outgoingInvitation,
    inviteToCrosstalk,
    acceptInvitation,
    declineInvitation,
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
