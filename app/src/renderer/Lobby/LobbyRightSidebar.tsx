import { useState } from "react";
import { X, LogIn, Headphones, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EditRoomDialog } from "@/renderer/Lobby/EditRoomDialog";
import { DeleteRoomDialog } from "@/renderer/Lobby/DeleteRoomDialog";
import type { Room } from "@/renderer/types";

type LobbyRightSidebarProps = {
  room: Room | null;
  participants: Array<{ userId: string; displayName: string }>;
  onJoin: (options: { audioEnabled: boolean }) => void;
  onClose: () => void;
  onRefreshRooms: () => void;
};

export function LobbyRightSidebar({
  room,
  participants,
  onJoin,
  onClose,
  onRefreshRooms,
}: LobbyRightSidebarProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!room) return null;

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l bg-background">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-sm font-semibold">
          {room.emoji} {room.name}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            title="Edit room"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Delete room"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-2 p-4">
        <Button className="w-full" onClick={() => onJoin({ audioEnabled: true })}>
          <LogIn className="mr-2 h-4 w-4" />
          Join
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onJoin({ audioEnabled: false })}
        >
          <Headphones className="mr-2 h-4 w-4" />
          Join without audio
        </Button>
      </div>

      <Separator />

      <div className="flex-1 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          In this room ({participants.length})
        </h3>
        {participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one here yet</p>
        ) : (
          <ul className="space-y-1">
            {participants.map((p) => (
              <li key={p.userId} className="flex items-center gap-2 text-sm">
                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                {p.displayName}
              </li>
            ))}
          </ul>
        )}
      </div>

      <EditRoomDialog
        room={room}
        open={editOpen}
        onOpenChange={setEditOpen}
        onUpdated={onRefreshRooms}
      />

      <DeleteRoomDialog
        room={room}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => {
          onClose();
          onRefreshRooms();
        }}
      />
    </aside>
  );
}
