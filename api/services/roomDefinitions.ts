import fs from "fs";
import path from "path";

export type RoomDefinition = {
  id: string;
  name: string;
  emoji: string;
  order: number;
};

const DEFAULT_ROOMS: RoomDefinition[] = [
  { id: "Team Standup", name: "Team Standup", emoji: "👥", order: 0 },
  { id: "Lounge", name: "Lounge", emoji: "🏖️", order: 1 },
  { id: "Meeting Room", name: "Meeting Room", emoji: "📋", order: 2 },
  { id: "Help Needed", name: "Help Needed", emoji: "⚡", order: 3 },
  { id: "Coffee Break", name: "Coffee Break", emoji: "☕", order: 4 },
  { id: "Library - Co-Working", name: "Library - Co-Working", emoji: "📚", order: 5 },
];

export class RoomDefinitionStore {
  private rooms: RoomDefinition[] = [];
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? path.join(__dirname, "..", "data", "rooms.json");
    this.load();
  }

  private load(): void {
    try {
      const raw = fs.readFileSync(this.filePath, "utf-8");
      this.rooms = JSON.parse(raw) as RoomDefinition[];
    } catch {
      // File doesn't exist or is malformed — seed with defaults
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      this.rooms = [...DEFAULT_ROOMS];
      this.save();
    }
  }

  private save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.filePath, JSON.stringify(this.rooms, null, 2) + "\n");
  }

  getAllRooms(): RoomDefinition[] {
    return [...this.rooms].sort((a, b) => a.order - b.order);
  }

  getRoom(id: string): RoomDefinition | null {
    return this.rooms.find((r) => r.id === id) ?? null;
  }

  createRoom(name: string, emoji: string): RoomDefinition {
    const id = name; // Use name as ID for backward compat
    const maxOrder = this.rooms.reduce((max, r) => Math.max(max, r.order), -1);
    const room: RoomDefinition = { id, name, emoji, order: maxOrder + 1 };
    this.rooms.push(room);
    this.save();
    return room;
  }

  updateRoom(id: string, updates: Partial<Pick<RoomDefinition, "name" | "emoji" | "order">>): RoomDefinition | null {
    const room = this.rooms.find((r) => r.id === id);
    if (!room) return null;

    if (updates.name !== undefined) room.name = updates.name;
    if (updates.emoji !== undefined) room.emoji = updates.emoji;
    if (updates.order !== undefined) room.order = updates.order;

    this.save();
    return { ...room };
  }

  deleteRoom(id: string): boolean {
    const idx = this.rooms.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    this.rooms.splice(idx, 1);
    this.save();
    return true;
  }

  reorderRooms(orderedIds: string[]): RoomDefinition[] {
    for (let i = 0; i < orderedIds.length; i++) {
      const room = this.rooms.find((r) => r.id === orderedIds[i]);
      if (room) room.order = i;
    }
    this.save();
    return this.getAllRooms();
  }
}
