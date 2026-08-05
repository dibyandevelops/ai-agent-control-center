import type { ReleaseGovernanceQueueItem } from "./types";

export type ReleaseGovernanceUrgency =
  | "on_track"
  | "urgent"
  | "escalated"
  | "overdue"
  | "executing"
  | "failed";

export function releaseGovernanceUrgency(
  item: Pick<ReleaseGovernanceQueueItem, "status" | "expiresAt">,
  now = Date.now(),
): ReleaseGovernanceUrgency {
  if (item.status === "failed") return "failed";
  if (item.status === "approved" || item.status === "executing") {
    return "executing";
  }
  const remaining = Date.parse(item.expiresAt) - now;
  if (remaining <= 0) return "overdue";
  if (remaining <= 4 * 60 * 60 * 1_000) return "escalated";
  if (remaining <= 12 * 60 * 60 * 1_000) return "urgent";
  return "on_track";
}

export function releaseGovernanceCountdown(expiresAt: string, now = Date.now()) {
  const remaining = Date.parse(expiresAt) - now;
  if (remaining <= 0) return "Review deadline passed";
  const totalMinutes = Math.ceil(remaining / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}
