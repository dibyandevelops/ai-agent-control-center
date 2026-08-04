import { describe, expect, it } from "vitest";
import type { AuditEvent } from "@/lib/types";
import {
  buildSevenDayActivity,
  summarizePolicyDecisions,
} from "./dashboard-metrics";

function event(
  result: AuditEvent["result"],
  time = "2026-08-04T12:00:00.000Z",
): AuditEvent {
  return {
    id: `${result}-${time}`,
    time,
    agent: "Release Agent",
    action: "deploy.release",
    result,
    actor: "agent",
    detail: "Test event",
  };
}

describe("dashboard metrics", () => {
  it("calculates compliance only from policy decision events", () => {
    const summary = summarizePolicyDecisions([
      event("Allowed"),
      event("Approved"),
      event("Blocked"),
      event("Changed"),
      event("Succeeded"),
    ]);

    expect(summary).toMatchObject({
      allowed: 1,
      approved: 1,
      blocked: 1,
      total: 3,
    });
    expect(summary.compliancePercent).toBeCloseTo(66.7, 1);
  });

  it("reports no percentage when no policy decisions exist", () => {
    expect(summarizePolicyDecisions([event("Changed")])).toMatchObject({
      total: 0,
      compliancePercent: null,
    });
  });

  it("groups only the last seven UTC days", () => {
    const points = buildSevenDayActivity(
      [
        event("Allowed", "2026-08-04T01:00:00.000Z"),
        event("Blocked", "2026-08-01T23:00:00.000Z"),
        event("Approved", "2026-07-28T23:59:59.000Z"),
      ],
      new Date("2026-08-04T16:00:00.000Z"),
    );

    expect(points).toHaveLength(7);
    expect(points[3]).toMatchObject({ day: "Sat", blocked: 1 });
    expect(points[6]).toMatchObject({ day: "Tue", allowed: 1 });
    expect(points.reduce((sum, point) => sum + point.approved, 0)).toBe(0);
  });
});
