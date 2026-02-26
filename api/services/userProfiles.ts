import fs from "fs";
import path from "path";

export type UserSettings = {
  notificationSounds: boolean;
  autoJoinAudio: boolean;
};

export type UserProfile = {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  settings: UserSettings;
};

const DEFAULT_SETTINGS: UserSettings = {
  notificationSounds: true,
  autoJoinAudio: true,
};

const DATA_DIR = path.join(__dirname, "..", "data");
const DATA_FILE = path.join(DATA_DIR, "profiles.json");

export class UserProfileStore {
  private profiles = new Map<string, UserProfile>();

  constructor() {
    this.loadFromDisk();
  }

  getProfile(userId: string): UserProfile | null {
    return this.profiles.get(userId) ?? null;
  }

  createProfile(userId: string, displayName: string): UserProfile {
    const profile: UserProfile = {
      userId,
      displayName,
      settings: { ...DEFAULT_SETTINGS },
    };
    this.profiles.set(userId, profile);
    this.saveToDisk();
    return profile;
  }

  updateProfile(
    userId: string,
    updates: Partial<Pick<UserProfile, "displayName" | "avatarUrl"> & { settings: Partial<UserSettings> }>,
  ): UserProfile | null {
    const existing = this.profiles.get(userId);
    if (!existing) return null;

    if (updates.displayName !== undefined) {
      existing.displayName = updates.displayName;
    }
    if (updates.avatarUrl !== undefined) {
      existing.avatarUrl = updates.avatarUrl;
    }
    if (updates.settings) {
      existing.settings = { ...existing.settings, ...updates.settings };
    }

    this.profiles.set(userId, existing);
    this.saveToDisk();
    return existing;
  }

  getAllProfiles(): UserProfile[] {
    return Array.from(this.profiles.values());
  }

  deleteProfile(userId: string): boolean {
    const existed = this.profiles.delete(userId);
    if (existed) this.saveToDisk();
    return existed;
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, "utf-8");
        const entries: UserProfile[] = JSON.parse(raw);
        for (const profile of entries) {
          this.profiles.set(profile.userId, profile);
        }
      }
    } catch {
      // Start fresh if the file is corrupt
    }
  }

  private saveToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const data = JSON.stringify(this.getAllProfiles(), null, 2);
      fs.writeFileSync(DATA_FILE, data, "utf-8");
    } catch {
      // Best-effort persistence
    }
  }
}
