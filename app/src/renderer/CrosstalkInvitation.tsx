import { useEffect, useState } from "react";
import { MessageSquare, X, Check } from "lucide-react";
import type { PendingCrosstalkInvitation } from "./CallContext";

type CrosstalkInvitationToastProps = {
  invitation: PendingCrosstalkInvitation;
  onAccept: (invitationId: string) => void;
  onDecline: (invitationId: string) => void;
};

function CrosstalkInvitationToast({
  invitation,
  onAccept,
  onDecline,
}: CrosstalkInvitationToastProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(30);

  useEffect(() => {
    const elapsed = Math.floor((Date.now() - invitation.receivedAt) / 1000);
    setRemainingSeconds(Math.max(0, 30 - elapsed));

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [invitation.receivedAt]);

  return (
    <div className="flex w-80 flex-col gap-3 rounded-lg border border-zinc-700 bg-zinc-800 p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600/20 text-indigo-400">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-100">Side conversation</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {invitation.inviterDisplayName} wants to start a side conversation
            with you
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">{remainingSeconds}s</span>
        <div className="flex gap-2">
          <button
            onClick={() => onDecline(invitation.invitationId)}
            className="flex h-8 items-center gap-1.5 rounded-md bg-zinc-700 px-3 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-600"
          >
            <X className="h-3 w-3" />
            Decline
          </button>
          <button
            onClick={() => onAccept(invitation.invitationId)}
            className="flex h-8 items-center gap-1.5 rounded-md bg-green-600 px-3 text-xs font-medium text-white transition-colors hover:bg-green-700"
          >
            <Check className="h-3 w-3" />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

type CrosstalkInvitationOverlayProps = {
  invitations: PendingCrosstalkInvitation[];
  onAccept: (invitationId: string) => void;
  onDecline: (invitationId: string) => void;
};

export default function CrosstalkInvitationOverlay({
  invitations,
  onAccept,
  onDecline,
}: CrosstalkInvitationOverlayProps) {
  if (invitations.length === 0) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-end p-4">
      <div className="pointer-events-auto flex flex-col gap-2">
        {invitations.map((inv) => (
          <CrosstalkInvitationToast
            key={inv.invitationId}
            invitation={inv}
            onAccept={onAccept}
            onDecline={onDecline}
          />
        ))}
      </div>
    </div>
  );
}
