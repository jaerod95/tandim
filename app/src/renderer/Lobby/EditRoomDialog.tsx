import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Room } from "@/renderer/types";

const API_URL = "http://localhost:3000";

type EditRoomDialogProps = {
  room: Room;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
};

export function EditRoomDialog({
  room,
  open,
  onOpenChange,
  onUpdated,
}: EditRoomDialogProps) {
  const [name, setName] = useState(room.name);
  const [emoji, setEmoji] = useState(room.emoji);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(room.name);
      setEmoji(room.emoji);
      setError(null);
      setSubmitting(false);
    }
  }, [open, room.name, room.emoji]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Room name is required");
      return;
    }
    if (trimmed.length > 30) {
      setError("Room name must be 30 characters or less");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_URL}/api/room-definitions/${encodeURIComponent(room.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, emoji: emoji.trim() || "💬" }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server error (${res.status})`);
      }

      onOpenChange(false);
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update room");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Room</DialogTitle>
            <DialogDescription>
              Update the room name or emoji.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-room-emoji">Emoji</Label>
              <Input
                id="edit-room-emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-20"
                maxLength={4}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-room-name">Name</Label>
              <Input
                id="edit-room-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                maxLength={30}
                autoFocus
              />
              <div className="flex items-center justify-between">
                {error ? (
                  <p className="text-xs text-destructive">{error}</p>
                ) : (
                  <span />
                )}
                <span className="text-xs text-muted-foreground">
                  {name.trim().length}/30
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
