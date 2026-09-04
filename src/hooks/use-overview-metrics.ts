"use client";

import { useMemo } from "react";
import type { Agent, Approval, AuditEvent } from "@/lib/types";
import { summarizePolicyDecisions } from "@/lib/dashboard-metrics";

export function calculateOverviewMetrics(
  agents: Agent[],
  approvals: Approval[],
  audit: AuditEvent[],
) {
  const totalSpend = agents.reduce((sum, agent) => sum + (agent.cost || 0), 0);
  const healthyAgents = agents.filter((agent) => agent.status === "healthy").length;
  const underReviewAgents = agents.length - healthyAgents;
  const healthyRatio = agents.length > 0 ? (healthyAgents / agents.length) * 100 : 100;

  const policySummary = summarizePolicyDecisions(audit);
  const complianceRatio = policySummary.compliancePercent ?? 100;
  const complianceFormatted =
    policySummary.compliancePercent === null
      ? "100.0%"
      : `${policySummary.compliancePercent.toFixed(1)}%`;

  const pendingApprovalsCount = approvals.filter(
    (a) => a.status === "pending",
  ).length;
  const highRiskApprovalsCount = approvals.filter(
    (a) => a.status === "pending" && a.risk === "high",
  ).length;

  return {
    totalSpend,
    totalAgents: agents.length,
    healthyAgents,
    underReviewAgents,
    healthyRatio,
    policySummary,
    complianceRatio,
    complianceFormatted,
    pendingApprovalsCount,
    highRiskApprovalsCount,
    hasPendingApprovals: pendingApprovalsCount > 0,
  };
}

export function useOverviewMetrics(
  agents: Agent[],
  approvals: Approval[],
  audit: AuditEvent[],
) {
  return useMemo(
    () => calculateOverviewMetrics(agents, approvals, audit),
    [agents, approvals, audit],
  );
}
