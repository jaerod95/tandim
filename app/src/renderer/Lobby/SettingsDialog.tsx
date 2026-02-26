import React, { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { UserProfile } from "@/hooks/use-user-profile";

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: UserProfile;
  onSave: (updates: {
    displayName?: string;
    settings?: { notificationSounds?: boolean; autoJoinAudio?: boolean };
  }) => Promise<void>;
};

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-violet-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-cyan-600",
  "bg-pink-600",
  "bg-teal-600",
];

function getAvatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function SettingsDialog({ open, onOpenChange, profile, onSave }: SettingsDialogProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [notificationSounds, setNotificationSounds] = useState(profile.settings.notificationSounds);
  const [autoJoinAudio, setAutoJoinAudio] = useState(profile.settings.autoJoinAudio);
  const [saving, setSaving] = useState(false);

  // Sync form state when profile changes (e.g., on open)
  useEffect(() => {
    setDisplayName(profile.displayName);
    setNotificationSounds(profile.settings.notificationSounds);
    setAutoJoinAudio(profile.settings.autoJoinAudio);
  }, [profile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSave({
        displayName: displayName !== profile.displayName ? displayName : undefined,
        settings: {
          ...(notificationSounds !== profile.settings.notificationSounds ? { notificationSounds } : {}),
          ...(autoJoinAudio !== profile.settings.autoJoinAudio ? { autoJoinAudio } : {}),
        },
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }, [displayName, notificationSounds, autoJoinAudio, profile, onSave, onOpenChange]);

  const colorClass = getAvatarColor(profile.userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your profile and preferences.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white ${colorClass}`}
            >
              {getInitials(displayName || profile.displayName)}
            </div>
            <div className="flex-1 text-sm text-muted-foreground">
              Avatar is generated from your initials.
            </div>
          </div>

          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Preferences</h3>

            <div className="flex items-center justify-between">
              <Label htmlFor="notification-sounds" className="cursor-pointer">
                Notification sounds
              </Label>
              <Switch
                id="notification-sounds"
                checked={notificationSounds}
                onCheckedChange={setNotificationSounds}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="auto-join-audio" className="cursor-pointer">
                Auto-join with audio
              </Label>
              <Switch
                id="auto-join-audio"
                checked={autoJoinAudio}
                onCheckedChange={setAutoJoinAudio}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !displayName.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
