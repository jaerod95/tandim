import { useCallback, useEffect, useState } from "react";

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

type ProfileUpdates = Partial<Pick<UserProfile, "displayName" | "avatarUrl"> & { settings: Partial<UserSettings> }>;

const DEFAULT_SETTINGS: UserSettings = {
  notificationSounds: true,
  autoJoinAudio: true,
};

type UseUserProfileOptions = {
  apiUrl: string;
  userId: string;
  defaultDisplayName: string;
};

type UseUserProfileReturn = {
  profile: UserProfile;
  loading: boolean;
  updateProfile: (updates: ProfileUpdates) => Promise<void>;
};

export function useUserProfile(options: UseUserProfileOptions): UseUserProfileReturn {
  const { apiUrl, userId, defaultDisplayName } = options;

  const [profile, setProfile] = useState<UserProfile>({
    userId,
    displayName: defaultDisplayName,
    settings: { ...DEFAULT_SETTINGS },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchOrCreate() {
      try {
        const res = await fetch(`${apiUrl}/api/profiles/${encodeURIComponent(userId)}`);
        if (res.ok) {
          const data: UserProfile = await res.json();
          if (!cancelled) setProfile(data);
        } else if (res.status === 404) {
          // Auto-create profile
          const createRes = await fetch(`${apiUrl}/api/profiles`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, displayName: defaultDisplayName }),
          });
          if (createRes.ok) {
            const data: UserProfile = await createRes.json();
            if (!cancelled) setProfile(data);
          }
        }
      } catch {
        // API unavailable, use local defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchOrCreate();
    return () => { cancelled = true; };
  }, [apiUrl, userId, defaultDisplayName]);

  const updateProfile = useCallback(async (updates: ProfileUpdates) => {
    // Optimistic update
    setProfile((prev) => ({
      ...prev,
      ...(updates.displayName !== undefined ? { displayName: updates.displayName } : {}),
      ...(updates.avatarUrl !== undefined ? { avatarUrl: updates.avatarUrl } : {}),
      settings: updates.settings
        ? { ...prev.settings, ...updates.settings }
        : prev.settings,
    }));

    try {
      const res = await fetch(`${apiUrl}/api/profiles/${encodeURIComponent(userId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data: UserProfile = await res.json();
        setProfile(data);
      }
    } catch {
      // Keep optimistic update if API is down
    }
  }, [apiUrl, userId]);

  return { profile, loading, updateProfile };
}
