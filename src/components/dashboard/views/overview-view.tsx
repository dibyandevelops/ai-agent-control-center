"use client";

import {
  Bot,
  Check,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  GitBranch,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import type { Agent, Approval, AuditEvent, OperatorIdentity } from "@/lib/types";
import {
  buildActivityChartData,
  summarizePolicyDecisions,
  type ActivityPoint,
  type ActivityTimeRange,
} from "@/lib/dashboard-metrics";
import { chartData } from "@/lib/demo-data";
import { AgentTable } from "./agents-view";
import {
  displayTime,
  EmptyState,
  money,
  Risk,
} from "../common/ui-helpers";

export function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <Icon className="metric-icon" />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function chartMaximum(data: ActivityPoint[]) {
  const rawMaximum = Math.max(
    1,
    ...data.flatMap((point) => [point.allowed, point.approved, point.blocked]),
  );
  if (rawMaximum <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawMaximum));
  const normalized = rawMaximum / magnitude;
  const rounded = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return rounded * magnitude;
}

export function ActivityChart({
  events,
  live,
  fallbackData,
}: {
  events: AuditEvent[];
  live: boolean;
  fallbackData: ActivityPoint[];
}) {
  const [timeRange, setTimeRange] = useState<ActivityTimeRange>("7d");
  const width = 760;
  const height = 210;
  const padding = { left: 38, right: 12, top: 10, bottom: 24 };

  const data = useMemo(() => {
    if (live || events.length > 0) {
      return buildActivityChartData(events, timeRange);
    }
    return fallbackData;
  }, [events, live, fallbackData, timeRange]);

  const max = chartMaximum(data);
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];
  const x = (index: number) =>
    padding.left +
    (index * (width - padding.left - padding.right)) / Math.max(1, data.length - 1);
  const y = (value: number) =>
    padding.top +
    (1 - value / max) * (height - padding.top - padding.bottom);
  const points = (key: "allowed" | "approved" | "blocked") =>
    data.map((item, index) => `${x(index)},${y(item[key])}`).join(" ");

  return (
    <section className="panel chart-panel">
      <div className="section-heading">
        <div>
          <h2>Actions over time</h2>
          <p>
            {timeRange === "24h"
              ? "Policy decisions across the last 24 hours"
              : timeRange === "14d"
                ? "Policy decisions across the last 14 days"
                : timeRange === "30d"
                  ? "Policy decisions across the last 30 days"
                  : "Policy decisions across the last 7 days"}
          </p>
        </div>
        <label className="select-field secondary-button flex items-center gap-1.5 cursor-pointer">
          <Clock3 className="h-3.5 w-3.5 text-sentinel-muted shrink-0" />
          <select
            className="bg-transparent text-xs text-sentinel-text outline-none cursor-pointer pr-1 font-medium"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as ActivityTimeRange)}
            aria-label="Filter actions over time chart by time range"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="14d">Last 14 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </label>
      </div>
      <div className="chart-legend" aria-hidden="true">
        <span><i className="legend-allowed" />Allowed</span>
        <span><i className="legend-approved" />Approved</span>
        <span><i className="legend-blocked" />Blocked</span>
      </div>
      <div className="chart-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Seven day chart of allowed, approved, and blocked agent actions"
        >
          {ticks.map((value) => (
            <g key={value}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y(value)}
                y2={y(value)}
                className="chart-grid-line"
              />
              <text x={0} y={y(value) + 3} className="chart-axis-label">
                {Math.round(value).toLocaleString()}
              </text>
            </g>
          ))}
          <polyline points={points("allowed")} className="chart-line chart-line-allowed" />
          <polyline points={points("approved")} className="chart-line chart-line-approved" />
          <polyline points={points("blocked")} className="chart-line chart-line-blocked" />
          {(["allowed", "approved", "blocked"] as const).flatMap((key) =>
            data.map((item, index) => (
              <circle
                key={`${key}-${item.day}`}
                cx={x(index)}
                cy={y(item[key])}
                r={key === "allowed" ? 3.5 : 3}
                className={`chart-point chart-point-${key}`}
              />
            )),
          )}
          {data.map((item, index) => (
            <text
              key={item.day}
              x={x(index)}
              y={height - 3}
              textAnchor="middle"
              className="chart-axis-label chart-day-label"
            >
              {item.day}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}

export function RiskPosture({ events }: { events: AuditEvent[] }) {
  return (
    <section className="panel risk-panel">
      <div className="section-heading">
        <div>
          <h2>Live risk posture</h2>
          <p>Latest policy events</p>
        </div>
        <span className="live-label"><span />Live</span>
      </div>
      <div className="risk-timeline">
        {events.slice(0, 5).map((event) => (
          <div className="risk-event" key={event.id}>
            <span className={`timeline-marker marker-${event.result.toLowerCase()}`}>
              {event.result === "Blocked" ? <ShieldAlert /> : <Check />}
            </span>
            <time>{displayTime(event.time)}</time>
            <div className="min-w-0">
              <strong className="block max-w-full truncate" title={event.action}>
                {event.action}
              </strong>
              <span>{event.agent}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ApprovalCard({
  approval,
  onDecision,
  canDecide,
}: {
  approval: Approval;
  onDecision: (approval: Approval, decision: "approved" | "denied") => Promise<void>;
  canDecide: boolean;
}) {
  const [pendingDecision, setPendingDecision] = useState<"approved" | "denied" | null>(null);

  async function submitDecision(decision: "approved" | "denied") {
    if (pendingDecision) return;
    setPendingDecision(decision);
    try {
      await onDecision(approval, decision);
    } finally {
      setPendingDecision(null);
    }
  }

  return (
    <article className="approval-card min-w-0 overflow-hidden">
      <div className="approval-meta">
        <Risk risk={approval.risk} />
        <time>{displayTime(approval.requestedAt)}</time>
      </div>
      <div className="approval-title">
        <span className="agent-icon">
          {approval.agentName.includes("GitHub") ? <GitBranch /> : <Bot />}
        </span>
        <div>
          <strong>{approval.agentName}</strong>
          <span>{approval.request}</span>
        </div>
      </div>
      <dl>
        <div>
          <dt>Resource</dt>
          <dd className="min-w-0 break-words [overflow-wrap:anywhere]" title={approval.resource}>
            {approval.resource}
          </dd>
        </div>
        <div>
          <dt>Context</dt>
          <dd className="min-w-0 break-words [overflow-wrap:anywhere]">
            {approval.context}
          </dd>
        </div>
      </dl>
      <div className="approval-actions">
        <button
          className="primary-button"
          disabled={!canDecide || Boolean(pendingDecision)}
          onClick={() => void submitDecision("approved")}
        >
          {pendingDecision === "approved" ? <LoaderCircle className="animate-spin" /> : <Check />}
          {pendingDecision === "approved" ? "Approving…" : "Approve"}
        </button>
        <button
          className="secondary-button"
          disabled={!canDecide || Boolean(pendingDecision)}
          onClick={() => void submitDecision("denied")}
        >
          {pendingDecision === "denied" ? <LoaderCircle className="animate-spin" /> : <XCircle />}
          {pendingDecision === "denied" ? "Denying…" : "Deny"}
        </button>
      </div>
    </article>
  );
}

export function ApprovalRail({
  approvals,
  onDecision,
  onViewAll,
  canDecide,
}: {
  approvals: Approval[];
  onDecision: (approval: Approval, decision: "approved" | "denied") => Promise<void>;
  onViewAll: () => void;
  canDecide: boolean;
}) {
  return (
    <aside className="approval-rail panel">
      <div className="section-heading">
        <div>
          <h2>Approval queue <span>{approvals.length}</span></h2>
          <p>Human review required</p>
        </div>
        <button className="text-button" onClick={onViewAll}>View all</button>
      </div>
      <div className="approval-list">
        {approvals.length ? (
          approvals.slice(0, 3).map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onDecision={onDecision}
              canDecide={canDecide}
            />
          ))
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="Queue cleared"
            description="There are no actions waiting for review."
          />
        )}
      </div>
    </aside>
  );
}

export function PilotReadiness({
  agents,
  audit,
  policyDecisions,
  onRegister,
  onOpenCredentials,
  onOpenIntegrations,
  onOpenPolicies,
}: {
  agents: Agent[];
  audit: AuditEvent[];
  policyDecisions: number;
  onRegister: () => void;
  onOpenCredentials: () => void;
  onOpenIntegrations: () => void;
  onOpenPolicies: () => void;
}) {
  const agentRegistered = agents.length > 0;
  const agentExercised = agents.some((agent) => agent.actions > 0);
  const mfaProtected = audit.some((event) => /mfa\.(enrolled|verified)/.test(event.action));
  const githubConnected = audit.some((event) => event.action === "github.app_installation_synced");
  const steps = [
    {
      complete: mfaProtected,
      title: "Secure your workspace",
      detail: "Use MFA and keep the first administrator account protected.",
      action: onOpenCredentials,
      actionLabel: "Open credentials",
    },
    {
      complete: githubConnected,
      title: "Connect GitHub",
      detail: "Install the GitHub App for only the repositories this organization governs.",
      action: onOpenIntegrations,
      actionLabel: "Open integrations",
    },
    {
      complete: agentRegistered,
      title: "Register an owned agent",
      detail: "Assign an accountable owner and keep permissions locked by default.",
      action: onRegister,
      actionLabel: "Register agent",
    },
    {
      complete: agentExercised,
      title: "Create and exercise a credential",
      detail: "Run the low-risk connection check before a consequential action.",
      action: onOpenCredentials,
      actionLabel: "Open credentials",
    },
    {
      complete: policyDecisions > 0,
      title: "Verify a policy decision",
      detail: "Send the first governed evaluation and inspect its audit evidence.",
      action: onOpenPolicies,
      actionLabel: "Review policies",
    },
    {
      complete: policyDecisions > 0,
      title: "Review the first action",
      detail: "Confirm the recorded decision and tamper-evident evidence in the audit log.",
      action: onOpenCredentials,
      actionLabel: "View quickstart",
    },
  ];
  const completeCount = steps.filter((step) => step.complete).length;
  return (
    <section className="mb-5 rounded-app border border-sentinel-lime/25 bg-sentinel-lime/5 p-4 shadow-app-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-sentinel-text">Workspace launch checklist</p>
          <p className="mt-1 text-xs text-sentinel-muted">Complete this path before connecting a production-impacting agent.</p>
        </div>
        <span className="rounded-full border border-sentinel-lime/30 px-2.5 py-1 text-[10px] font-semibold text-sentinel-lime">
          {completeCount}/6 complete
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-xl border border-sentinel-line bg-sentinel-surface/70 p-3">
            <div className="flex items-start gap-2">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                  step.complete
                    ? "border-sentinel-lime/40 bg-sentinel-lime/10 text-sentinel-lime"
                    : "border-sentinel-line text-sentinel-muted"
                }`}
              >
                {step.complete ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px]">{index + 1}</span>}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sentinel-text">{step.title}</p>
                <p className="mt-1 text-[11px] leading-5 text-sentinel-muted">{step.detail}</p>
              </div>
            </div>
            {step.complete ? (
              <p className="mt-3 text-[11px] font-medium text-sentinel-lime">Complete</p>
            ) : (
              <button className="mt-3 text-xs font-semibold text-sentinel-lime" onClick={step.action}>
                {step.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

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
  const totalSpend = agents.reduce((sum, agent) => sum + agent.cost, 0);
  const healthyAgents = agents.filter((agent) => agent.status === "healthy").length;
  const policySummary = useMemo(() => summarizePolicyDecisions(audit), [audit]);
  const compliance =
    policySummary.compliancePercent === null
      ? "—"
      : `${policySummary.compliancePercent.toFixed(1)}%`;

  return (
    <main className="page overview-page">
      <div className="page-title-row">
        <div>
          <h2>{operator ? `Welcome, ${operator.displayName}` : "Welcome to SentinelOps"}</h2>
          <p>
            {live
              ? "Your live AI workforce and governance activity."
              : "Explore the AI governance control center in demo mode."}
          </p>
        </div>
        <button className="primary-button primary-large" onClick={onRegister}>
          <Bot /> Register agent
        </button>
      </div>
      {live ? (
        <PilotReadiness
          agents={agents}
          audit={audit}
          policyDecisions={policySummary.total}
          onRegister={onRegister}
          onOpenCredentials={onOpenCredentials}
          onOpenIntegrations={onOpenIntegrations}
          onOpenPolicies={onOpenPolicies}
        />
      ) : null}
      <section className="metrics-band">
        <Metric
          icon={Bot}
          label="Registered agents"
          value={String(agents.length)}
          detail={`${healthyAgents} healthy`}
        />
        <Metric
          icon={ShieldCheck}
          label="Policy compliance"
          value={compliance}
          detail={
            policySummary.total
              ? `${policySummary.total} decisions in the current audit window`
              : "No policy decisions yet"
          }
        />
        <Metric
          icon={ClipboardCheck}
          label="Pending approvals"
          value={String(approvals.length)}
          detail="Requires review"
        />
        <Metric
          icon={CircleDollarSign}
          label="Recorded AI spend"
          value={money(totalSpend)}
          detail={`Across ${agents.length} registered agent${agents.length === 1 ? "" : "s"}`}
        />
      </section>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <div className="analytics-grid">
            <ActivityChart events={audit} live={live} fallbackData={chartData} />
            <RiskPosture events={audit} />
          </div>
          <AgentTable agents={agents} compact auditLogs={audit} />
        </div>
        <ApprovalRail
          approvals={approvals}
          onDecision={onDecision}
          onViewAll={onViewApprovals}
          canDecide={canDecide}
        />
      </div>
    </main>
  );
}
