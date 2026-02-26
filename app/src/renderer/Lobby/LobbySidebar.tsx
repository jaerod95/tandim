import * as React from "react";
import { useState } from "react";
import { Volume2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Room } from "@/renderer/types";
import { CreateRoomDialog } from "@/renderer/Lobby/CreateRoomDialog";
import { EditRoomDialog } from "@/renderer/Lobby/EditRoomDialog";
import { DeleteRoomDialog } from "@/renderer/Lobby/DeleteRoomDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuBadge,
  SidebarRail,
} from "@/components/ui/sidebar";

type LobbySidebarProps = React.ComponentProps<typeof Sidebar> & {
  rooms: Room[];
  selectedRoom: string | null;
  onSelectRoom: (roomId: string) => void;
  roomOccupancy: Map<string, number>;
  onRefreshRooms: () => void;
};

export function LobbySidebar({
  rooms,
  selectedRoom,
  onSelectRoom,
  roomOccupancy,
  onRefreshRooms,
  ...props
}: LobbySidebarProps) {
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [deleteRoom, setDeleteRoom] = useState<Room | null>(null);

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <Volume2 className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Tandim</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <div className="flex items-center justify-between">
            <SidebarGroupLabel>Rooms</SidebarGroupLabel>
            <CreateRoomDialog onCreated={onRefreshRooms} />
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {rooms.map((room) => {
                const count = roomOccupancy.get(room.name) ?? 0;
                return (
                  <SidebarMenuItem key={room.id} className="group/room">
                    <SidebarMenuButton
                      isActive={room.name === selectedRoom}
                      onClick={() => onSelectRoom(room.name)}
                    >
                      <span>{room.emoji}</span>
                      <span>{room.name}</span>
                    </SidebarMenuButton>
                    {count > 0 && (
                      <SidebarMenuBadge>{count}</SidebarMenuBadge>
                    )}
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/room:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="h-5 w-5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditRoom(room)}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteRoom(room)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />

      {editRoom && (
        <EditRoomDialog
          room={editRoom}
          open={!!editRoom}
          onOpenChange={(open) => {
            if (!open) setEditRoom(null);
          }}
          onUpdated={onRefreshRooms}
        />
      )}

      {deleteRoom && (
        <DeleteRoomDialog
          room={deleteRoom}
          open={!!deleteRoom}
          onOpenChange={(open) => {
            if (!open) setDeleteRoom(null);
          }}
          onDeleted={onRefreshRooms}
        />
      )}
    </Sidebar>
  );
}
