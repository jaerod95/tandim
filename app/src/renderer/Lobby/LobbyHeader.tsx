import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

type LobbyHeaderProps = {
  title: string;
};

export function LobbyHeader({ title }: LobbyHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 h-4" />
      <h1 className="text-sm font-medium">{title}</h1>
    </header>
  );
}
