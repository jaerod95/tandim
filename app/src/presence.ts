export type PresenceUser = {
  userId: string;
  displayName: string;
  state: "you" | "connected";
};

export class PresenceState {
  private readonly users = new Map<string, PresenceUser>();

  upsert(user: PresenceUser): void {
    this.users.set(user.userId, user);
  }

  remove(userId: string): void {
    this.users.delete(userId);
  }

  clear(): void {
    this.users.clear();
  }

  snapshot(): PresenceUser[] {
    return Array.from(this.users.values()).sort((a, b) => {
      if (a.state === "you" && b.state !== "you") {
        return -1;
      }
      if (a.state !== "you" && b.state === "you") {
        return 1;
      }
      return a.displayName.localeCompare(b.displayName);
    });
  }
}
