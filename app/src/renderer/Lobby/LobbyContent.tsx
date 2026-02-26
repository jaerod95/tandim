type TeamMember = {
  name: string;
  status: "online" | "idle" | "offline";
  isYou?: boolean;
};

type LobbyContentProps = {
  displayName: string;
};

const TEAM: TeamMember[] = [
  { name: "", status: "online", isYou: true },
  { name: "Jordin", status: "offline" },
];

function StatusDot({ status }: { status: TeamMember["status"] }) {
  const colors = {
    online: "bg-green-500",
    idle: "bg-yellow-500",
    offline: "bg-zinc-500",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[status]}`} />;
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

export function LobbyContent({ displayName }: LobbyContentProps) {
  const members = TEAM.map((m) =>
    m.isYou ? { ...m, name: displayName } : m,
  );

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Team
      </h2>
      <ul className="space-y-1">
        {members.map((member) => (
          <li
            key={member.name}
            className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent"
          >
            <Initials name={member.name} />
            <div className="flex flex-1 items-center gap-2">
              <span className="text-sm">{member.name}</span>
              {member.isYou && (
                <span className="text-xs text-muted-foreground">(you)</span>
              )}
            </div>
            <StatusDot status={member.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
