import * as React from "react";
import { ROOMS } from "@/renderer/types";
import { TandimLogo } from "@/components/TandimLogo";
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
        <TandimLogo size="md" className="px-2 py-1" />
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
