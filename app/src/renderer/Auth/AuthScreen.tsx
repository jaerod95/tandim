import React, { useState, useCallback, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthScreenProps = {
  onLogin: (displayName: string, password: string) => Promise<void>;
  onRegister: (displayName: string, password: string) => Promise<void>;
  error: string | null;
};

export function AuthScreen({ onLogin, onRegister, error }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!displayName.trim() || !password.trim()) return;

      setSubmitting(true);
      try {
        if (mode === "login") {
          await onLogin(displayName.trim(), password);
        } else {
          await onRegister(displayName.trim(), password);
        }
      } catch {
        // Error is displayed via the error prop
      } finally {
        setSubmitting(false);
      }
    },
    [mode, displayName, password, onLogin, onRegister],
  );

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-100">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Tandim</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login"
              ? "Sign in to your workspace"
              : "Create your account"}
          </p>
        </div>

        <div className="flex gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "login"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === "register"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              type="text"
              placeholder="Your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoFocus
              required
              minLength={1}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              maxLength={128}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || !displayName.trim() || !password.trim()}
          >
            {submitting
              ? "Loading..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>
      </div>
    </div>
  );
}
