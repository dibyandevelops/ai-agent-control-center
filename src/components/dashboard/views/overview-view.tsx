"use client";

import React, { useRef } from "react";
import type { Agent, Approval, AuditEvent, OperatorIdentity } from "@/lib/types";
import { chartData } from "@/lib/demo-data";

// Modular sub-components
import { OverviewHeader } from "../overview/overview-header";
import { MetricsDeck, MetricCard } from "../overview/metrics-deck";
import { ActivityChart } from "../overview/activity-chart";
import { RiskPosture } from "../overview/risk-posture";
import { ApprovalCard } from "../overview/approval-card";
import { ApprovalRail } from "../overview/approval-rail";
import { PilotReadiness } from "../overview/pilot-readiness";
import { OperationsHub, AgentActivityFeed } from "../overview/operations-hub";

// Re-export for 100% backwards compatibility with external views and test suites
export {
  OverviewHeader,
  MetricsDeck,
  MetricCard,
  MetricCard as Metric,
  ActivityChart,
  RiskPosture,
  ApprovalCard,
  ApprovalRail,
  PilotReadiness,
  OperationsHub,
  AgentActivityFeed,
};

export function OverviewView({
  agents,
  approvals,
  audit,
  operator,
  live,
  onRegister,
  onDecision,
  onViewApprovals,
  onOpenCredentials,
  onOpenIntegrations,
  onOpenPolicies,
  canDecide,
}: {
  agents: Agent[];
  approvals: Approval[];
  audit: AuditEvent[];
  operator: OperatorIdentity | null;
  live: boolean;
  onRegister: () => void;
  onDecision: (approval: Approval, decision: "approved" | "denied") => Promise<void>;
  onViewApprovals: () => void;
  onOpenCredentials: () => void;
  onOpenIntegrations: () => void;
  onOpenPolicies: () => void;
  canDecide: boolean;
}) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handlePinnedWheel = (e: React.WheelEvent) => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop += e.deltaY;
    }
  };

  return (
    <main className="page overview-page">
      {/* 1. Pinned Top Deck: Mission Control Header, Launch Checklist, 4-Card KPI Metric Deck */}
      <div className="pinned-overview-deck shrink-0 space-y-3" onWheel={handlePinnedWheel}>
        <OverviewHeader
          operator={operator}
          live={live}
          onRegister={onRegister}
          onOpenPolicies={onOpenPolicies}
          onOpenIntegrations={onOpenIntegrations}
        />

        {live && (
          <PilotReadiness
            agents={agents}
            audit={audit}
            policyDecisions={audit.length}
            onRegister={onRegister}
            onOpenCredentials={onOpenCredentials}
            onOpenIntegrations={onOpenIntegrations}
            onOpenPolicies={onOpenPolicies}
          />
        )}

        <MetricsDeck
          agents={agents}
          approvals={approvals}
          audit={audit}
          className="mb-0"
        />
      </div>

      {/* 2. Independently Scrollable Workspace: Operations Hub (Fleet Roster Table & Telemetry), Analytics Line Chart, Risk Posture, and Consequential Approvals */}
      <div ref={scrollAreaRef} className="overview-scroll-area flex-1 min-h-0 overflow-y-auto pr-1 pb-4 pt-3.5 space-y-5">
        <div className="dashboard-grid">
          {/* Main Column: Operations Center & Analytics */}
          <div className="dashboard-main space-y-5 min-w-0">
            {/* Unified Operations Hub (Fleet Roster / Live Telemetry / Security Gate) */}
            <OperationsHub
              agents={agents}
              audit={audit}
              onOpenPolicies={onOpenPolicies}
            />

            {/* Analytics Line Chart & Threat Posture */}
            <div className="analytics-grid">
              <ActivityChart events={audit} live={live} fallbackData={chartData} />
              <RiskPosture events={audit} onOpenPolicies={onOpenPolicies} />
            </div>
          </div>

          {/* Right Sidebar: Human-in-the-Loop Consequential Approvals */}
          <ApprovalRail
            approvals={approvals}
            onDecision={onDecision}
            onViewAll={onViewApprovals}
            canDecide={canDecide}
          />
        </div>
      </div>
    </main>
  );
}
