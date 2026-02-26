import type { PresenceStatus, UserPresence } from "@/hooks/use-presence";
import { ROOMS } from "@/renderer/types";

type LobbyContentProps = {
  displayName: string;
  userId: string;
  users: UserPresence[];
};

const STATUS_DOT_COLORS: Record<PresenceStatus, string> = {
  available: "bg-green-500",
  "in-call": "bg-blue-500",
  idle: "bg-yellow-500",
  dnd: "bg-red-500",
  offline: "bg-zinc-500",
};

const STATUS_LABELS: Record<PresenceStatus, string> = {
  available: "Available",
  "in-call": "In a call",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
};

function StatusDot({ status }: { status: PresenceStatus }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT_COLORS[status]}`} />;
}

function Initials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-xs font-medium text-zinc-200">
      {initials}
    </div>
  );
}

function RoomLabel({ room }: { room: { workspaceId: string; roomId: string } }) {
  const roomDef = ROOMS.find((r) => r.name === room.roomId);
  const label = roomDef ? `${roomDef.emoji} ${roomDef.name}` : room.roomId;
  return <span className="text-xs text-muted-foreground">{label}</span>;
}

export function LobbyContent({ displayName, userId, users }: LobbyContentProps) {
  // Sort: "you" first, then by display name
  const sorted = [...users].sort((a, b) => {
    if (a.userId === userId) return -1;
    if (b.userId === userId) return 1;
    return a.displayName.localeCompare(b.displayName);
  });

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Team ({users.length})
      </h2>
      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">Connecting...</p>
      ) : (
        <ul className="space-y-1">
          {sorted.map((user) => {
            const isYou = user.userId === userId;
            return (
              <li
                key={user.userId}
                className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent"
              >
                <Initials name={user.displayName} />
                <div className="flex flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{user.displayName}</span>
                    {isYou && (
                      <span className="text-xs text-muted-foreground">(you)</span>
                    )}
                  </div>
                  {user.status === "in-call" && user.currentRoom && (
                    <RoomLabel room={user.currentRoom} />
                  )}
                  {user.status !== "available" && user.status !== "in-call" && (
                    <span className="text-xs text-muted-foreground">
                      {STATUS_LABELS[user.status]}
                    </span>
                  )}
                </div>
                <StatusDot status={user.status} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
