import { useEffect, useState } from "react";
import { Phone, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type QuickTalkNotificationProps = {
  roomId: string;
  fromDisplayName: string;
  onAccept: (roomId: string) => void;
  onDecline: (roomId: string) => void;
};

const AUTO_DISMISS_MS = 30_000;

export function QuickTalkNotification({
  roomId,
  fromDisplayName,
  onAccept,
  onDecline,
}: QuickTalkNotificationProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDecline(roomId);
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [roomId, onDecline]);

  if (!visible) return null;

  return (
    <div className="animate-in slide-in-from-top-2 fixed right-4 top-4 z-50 flex items-center gap-3 rounded-lg border bg-background p-4 shadow-lg">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20">
        <Phone className="h-5 w-5 text-blue-400" />
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{fromDisplayName} wants to talk</span>
        <span className="text-xs text-muted-foreground">Quick talk request</span>
      </div>
      <div className="ml-2 flex gap-2">
        <Button
          size="sm"
          variant="default"
          className="bg-green-600 hover:bg-green-700"
          onClick={() => {
            setVisible(false);
            onAccept(roomId);
          }}
        >
          <Phone className="mr-1 h-3.5 w-3.5" />
          Accept
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-red-400 hover:bg-red-950 hover:text-red-300"
          onClick={() => {
            setVisible(false);
            onDecline(roomId);
          }}
        >
          <PhoneOff className="mr-1 h-3.5 w-3.5" />
          Decline
        </Button>
      </div>
    </div>
  );
}
