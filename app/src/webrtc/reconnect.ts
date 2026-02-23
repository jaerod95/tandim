export function computeReconnectDelayMs(attempt: number): number {
  const cappedAttempt = Math.max(0, Math.min(attempt, 6));
  const base = 500;
  return base * 2 ** cappedAttempt;
}

export function shouldRetryConnection(lastErrorCode: string): boolean {
  return !["auth_failed", "forbidden_workspace"].includes(lastErrorCode);
}
