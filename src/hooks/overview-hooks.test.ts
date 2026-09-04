import { describe, expect, it } from "vitest";
import type { Agent, Approval, AuditEvent } from "@/lib/types";
import { calculateOverviewMetrics } from "./use-overview-metrics";
import { calculateRiskPosture } from "./use-risk-posture";
import { chartMaximum } from "./use-activity-telemetry";
import { OVERVIEW_QUERY_KEY } from "./use-overview-query";

const sampleAgents: Agent[] = [
  {
    id: "agent-1",
    name: "Billing Agent",
    owner: "Finance",
    team: "Core",
    provider: "OpenAI",
    status: "healthy",
    cost: 150,
    actions: 120,
    lastAction: "deploy",
    permissions: ["stripe.refund"],
    lastSeen: "1m ago",
    description: "Processes invoices",
  },
  {
    id: "agent-2",
    name: "Customer Support Agent",
    owner: "Support",
    team: "Ops",
    provider: "Anthropic",
    status: "review",
    cost: 250,
    actions: 80,
    lastAction: "read",
    permissions: ["zendesk.read"],
    lastSeen: "5m ago",
    description: "Answers user queries",
  },
];

const sampleApprovals: Approval[] = [
  {
    id: "app-1",
    agentId: "agent-1",
    agentName: "Billing Agent",
    request: "Refund $500",
    resource: "stripe.charges.refund",
    risk: "high",
    requestedBy: "agent-1",
    context: "Customer requested compensation",
    requestedAt: "2026-09-04T12:00:00Z",
    status: "pending",
  },
  {
    id: "app-2",
    agentId: "agent-2",
    agentName: "Support Agent",
    request: "Reset password",
    resource: "auth.users.reset",
    risk: "low",
    requestedBy: "agent-2",
    context: "User forgotten PIN",
    requestedAt: "2026-09-04T12:05:00Z",
    status: "approved",
  },
];

const sampleAudit: AuditEvent[] = [
  {
    id: "evt-1",
    time: "2026-09-04T12:00:00Z",
    agent: "Billing Agent",
    action: "stripe.charges.refund",
    result: "Blocked",
    actor: "policy_engine",
    detail: "High-value refund requires human sign-off",
  },
  {
    id: "evt-2",
    time: "2026-09-04T12:01:00Z",
    agent: "Support Agent",
    action: "users.search",
    result: "Allowed",
    actor: "agent",
    detail: "Read query compliant",
  },
  {
    id: "evt-3",
    time: "2026-09-04T12:02:00Z",
    agent: "Billing Agent",
    action: "stripe.charges.refund",
    result: "Approved",
    actor: "operator",
    detail: "Human operator approved refund",
  },
];

describe("Overview Custom Hooks & Query Constants", () => {
  it("defines standard query keys for React Query overview caching", () => {
    expect(OVERVIEW_QUERY_KEY).toEqual(["control-center", "overview"]);
  });

  it("calculates fleet spend, health ratio, and policy compliance accurately in calculateOverviewMetrics", () => {
    const metrics = calculateOverviewMetrics(sampleAgents, sampleApprovals, sampleAudit);

    expect(metrics.totalSpend).toBe(400);
    expect(metrics.totalAgents).toBe(2);
    expect(metrics.healthyAgents).toBe(1);
    expect(metrics.underReviewAgents).toBe(1);
    expect(metrics.healthyRatio).toBe(50);
    expect(metrics.pendingApprovalsCount).toBe(1);
    expect(metrics.highRiskApprovalsCount).toBe(1);
    expect(metrics.hasPendingApprovals).toBe(true);
    expect(metrics.policySummary.total).toBe(3);
    expect(metrics.policySummary.allowed).toBe(1);
    expect(metrics.policySummary.blocked).toBe(1);
    expect(metrics.policySummary.approved).toBe(1);
    expect(metrics.complianceRatio).toBeCloseTo(66.7, 1);
    expect(metrics.complianceFormatted).toBe("66.7%");
  });

  it("evaluates live risk posture, block counts, and slices recent events in calculateRiskPosture", () => {
    const risk = calculateRiskPosture(sampleAudit, 2);

    expect(risk.blockedCount).toBe(1);
    expect(risk.approvedCount).toBe(1);
    expect(risk.totalInterceptions).toBe(2);
    expect(risk.blockRatio).toBe(50);
    expect(risk.recentEvents).toHaveLength(2);
    expect(risk.recentEvents[0].id).toBe("evt-1");
    expect(risk.isHighRisk).toBe(true);
  });

  it("calculates chart bounds and maximum scale correctly with chartMaximum", () => {
    expect(chartMaximum([{ day: "Mon", allowed: 2, approved: 1, blocked: 0 }])).toBe(4);
    expect(chartMaximum([{ day: "Mon", allowed: 8, approved: 3, blocked: 1 }])).toBe(10);
    expect(chartMaximum([{ day: "Mon", allowed: 35, approved: 10, blocked: 5 }])).toBe(50);
    expect(chartMaximum([{ day: "Mon", allowed: 85, approved: 20, blocked: 10 }])).toBe(100);
  });
});
