import * as React from "react";
import { useState } from "react";
import { Plus } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";

const API_URL = "http://localhost:3000";

type CreateRoomDialogProps = {
  onCreated: () => void;
};

export function CreateRoomDialog({ onCreated }: CreateRoomDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💬");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setEmoji("💬");
    setError(null);
    setSubmitting(false);
  }

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
      const res = await fetch(`${API_URL}/api/room-definitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, emoji: emoji.trim() || "💬" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Server error (${res.status})`);
      }

      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-xs" title="Create room">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Room</DialogTitle>
            <DialogDescription>
              Add a new room to the workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="room-emoji">Emoji</Label>
              <Input
                id="room-emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                className="w-20"
                maxLength={4}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="room-name">Name</Label>
              <Input
                id="room-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Design Review"
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
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
