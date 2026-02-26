import { Settings, BellOff, Bell } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TandimLogo } from "@/components/TandimLogo";

type LobbyHeaderProps = {
  title: string;
  dndActive: boolean;
  onToggleDnd: () => void;
  onOpenSettings?: () => void;
};

export function LobbyHeader({ title, dndActive, onToggleDnd, onOpenSettings }: LobbyHeaderProps) {
  const showLogo = title === "Tandim";

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 h-4" />
      {showLogo ? (
        <TandimLogo size="sm" />
      ) : (
        <h1 className="text-sm font-medium">{title}</h1>
      )}
      <div className="ml-auto flex items-center gap-2">
        {dndActive && (
          <span className="text-xs font-medium text-red-500">DND</span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={dndActive ? "destructive" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={onToggleDnd}
              aria-label={dndActive ? "Turn off Do Not Disturb" : "Do Not Disturb"}
            >
              {dndActive ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {dndActive ? "Turn off Do Not Disturb" : "Do Not Disturb"}
          </TooltipContent>
        </Tooltip>
        {onOpenSettings && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onOpenSettings}
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
