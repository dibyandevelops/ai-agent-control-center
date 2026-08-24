import type { AuditEvent } from "@/lib/types";

export interface ActivityPoint {
  day: string;
  allowed: number;
  approved: number;
  blocked: number;
}

export type ActivityTimeRange = "24h" | "7d" | "14d" | "30d";

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

export function buildActivityChartData(
  events: AuditEvent[],
  range: ActivityTimeRange = "7d",
  now = new Date(),
): ActivityPoint[] {
  if (range === "24h") {
    // 6 intervals of 4 hours
    const points: Array<ActivityPoint & { startMs: number; endMs: number }> = [];
    const nowMs = now.getTime();
    const intervalMs = 4 * 3600 * 1000;

    for (let i = 5; i >= 0; i -= 1) {
      const end = nowMs - i * intervalMs;
      const start = end - intervalMs;
      const pointDate = new Date(end);
      const hourStr = pointDate.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      points.push({
        day: hourStr,
        startMs: start,
        endMs: end,
        allowed: 0,
        approved: 0,
        blocked: 0,
      });
    }

    for (const event of events) {
      if (!decisionResults.has(event.result)) continue;
      const parsed = new Date(event.time);
      const timeMs = parsed.getTime();
      if (Number.isNaN(timeMs)) continue;
      const targetPoint = points.find((p) => timeMs >= p.startMs && timeMs <= p.endMs);
      if (targetPoint) {
        const key = event.result.toLowerCase() as "allowed" | "approved" | "blocked";
        targetPoint[key] += 1;
      }
    }

    return points.map((p) => ({
      day: p.day,
      allowed: p.allowed,
      approved: p.approved,
      blocked: p.blocked,
    }));
  }

  const daysCount = range === "30d" ? 30 : range === "14d" ? 14 : 7;
  const days: Array<ActivityPoint & { key: string }> = [];
  const dayIndex = new Map<string, number>();

  for (let offset = daysCount - 1; offset >= 0; offset -= 1) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset),
    );
    const key = utcDayKey(date);
    dayIndex.set(key, days.length);

    let label: string;
    if (daysCount <= 7) {
      label = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(date);
    } else {
      label = `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
    }

    days.push({
      key,
      day: label,
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

export function buildSevenDayActivity(
  events: AuditEvent[],
  now = new Date(),
): ActivityPoint[] {
  return buildActivityChartData(events, "7d", now);
}
