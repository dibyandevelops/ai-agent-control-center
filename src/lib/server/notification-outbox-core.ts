export function retryDelaySeconds(attemptCount: number) {
  const normalizedAttempt = Math.max(1, Math.floor(attemptCount));
  return Math.min(21_600, 60 * 2 ** (normalizedAttempt - 1));
}

export function notificationFailureStatus(
  attemptCount: number,
  maxAttempts: number,
) {
  return attemptCount >= maxAttempts ? "dead" as const : "pending" as const;
}
