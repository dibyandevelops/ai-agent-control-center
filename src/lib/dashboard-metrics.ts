import type { AuditEvent } from "@/lib/types";

export interface ActivityPoint {
  day: string;
  allowed: number;
  approved: number;
  blocked: number;
}

export interface PolicyDecisionSummary {
  allowed: number;
  approved: number;
  blocked: number;
  total: number;
  compliancePercent: number | null;
}

const decisionResults = new Set<AuditEvent["result"]>([
  "Allowed",
  "Approved",
  "Blocked",
]);

function utcDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function summarizePolicyDecisions(
  events: AuditEvent[],
): PolicyDecisionSummary {
  const summary: PolicyDecisionSummary = {
    allowed: 0,
    approved: 0,
    blocked: 0,
    total: 0,
    compliancePercent: null,
  };

  for (const event of events) {
    if (!decisionResults.has(event.result)) continue;
    summary[event.result.toLowerCase() as "allowed" | "approved" | "blocked"] += 1;
    summary.total += 1;
  }

  if (summary.total > 0) {
    summary.compliancePercent =
      ((summary.allowed + summary.approved) / summary.total) * 100;
  }

  return summary;
}

export function buildSevenDayActivity(
  events: AuditEvent[],
  now = new Date(),
): ActivityPoint[] {
  const days: Array<ActivityPoint & { key: string }> = [];
  const dayIndex = new Map<string, number>();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset),
    );
    const key = utcDayKey(date);
    dayIndex.set(key, days.length);
    days.push({
      key,
      day: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }).format(date),
      allowed: 0,
      approved: 0,
      blocked: 0,
    });
  }

  for (const event of events) {
    if (!decisionResults.has(event.result)) continue;
    const parsed = new Date(event.time);
    if (Number.isNaN(parsed.getTime())) continue;
    const index = dayIndex.get(utcDayKey(parsed));
    if (index === undefined) continue;
    const key = event.result.toLowerCase() as "allowed" | "approved" | "blocked";
    days[index][key] += 1;
  }

  return days.map((day) => ({
    day: day.day,
    allowed: day.allowed,
    approved: day.approved,
    blocked: day.blocked,
  }));
}
