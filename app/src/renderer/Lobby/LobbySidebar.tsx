import * as React from "react";
import { Volume2 } from "lucide-react";
import { ROOMS } from "@/renderer/types";
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
  selectedRoom: string | null;
  onSelectRoom: (roomId: string) => void;
  roomOccupancy: Map<string, number>;
};

export function LobbySidebar({
  selectedRoom,
  onSelectRoom,
  roomOccupancy,
  ...props
}: LobbySidebarProps) {
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
          <SidebarGroupLabel>Rooms</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ROOMS.map((room) => {
                const count = roomOccupancy.get(room.name) ?? 0;
                return (
                  <SidebarMenuItem key={room.name}>
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
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
