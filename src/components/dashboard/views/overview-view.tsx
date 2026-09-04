"use client";

import {
  Activity,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GitBranch,
  Layers,
  LoaderCircle,
  Lock,
  Plus,
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
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
  badge,
  badgeColor = "text-sentinel-lime border-sentinel-lime/30 bg-sentinel-lime/10",
}: {
  icon: typeof Bot;
  label: string;
  value: string;
  detail: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <div className="metric group relative transition-all duration-200 hover:bg-sentinel-surface/40">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sentinel-line bg-sentinel-canvas/70 text-sentinel-lime shadow-sm transition-transform duration-200 group-hover:scale-105">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span>{label}</span>
          {badge ? (
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-normal uppercase ${badgeColor}`}>
              {badge}
            </span>
          ) : null}
        </div>
        <strong>{value}</strong>
        <small className="truncate">{detail}</small>
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
  detailed = false,
}: {
  approval: Approval;
  onDecision: (approval: Approval, decision: "approved" | "denied") => Promise<void>;
  canDecide: boolean;
  detailed?: boolean;
}) {
  const [pendingDecision, setPendingDecision] = useState<"approved" | "denied" | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  async function submitDecision(decision: "approved" | "denied") {
    if (pendingDecision) return;
    setPendingDecision(decision);
    try {
      await onDecision(approval, decision);
    } finally {
      setPendingDecision(null);
    }
  }

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard?.writeText(approval.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write errors
    }
  };

  const isHighRisk = approval.risk === "high";

  return (
    <article
      className={`approval-card min-w-0 overflow-hidden transition-all duration-200 ${
        isHighRisk
          ? "border-red-500/30 bg-gradient-to-b from-red-500/[0.04] to-transparent shadow-sm"
          : ""
      }`}
    >
      <div className="approval-meta">
        <div className="flex items-center gap-2">
          <Risk risk={approval.risk} />
          {isHighRisk && (
            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-500 dark:text-red-400">
              Sign-Off Required
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyId}
            title="Click to copy Request ID"
            className="flex items-center gap-1 rounded border border-sentinel-line/80 bg-sentinel-canvas/70 px-1.5 py-0.5 font-mono text-[9px] text-sentinel-muted hover:text-sentinel-text hover:border-sentinel-line"
          >
            {copied ? <Check className="h-2.5 w-2.5 text-sentinel-lime" /> : <Copy className="h-2.5 w-2.5" />}
            <span>#{approval.id.slice(0, 7)}</span>
          </button>
          <time className="text-[9px] text-sentinel-muted font-mono">{displayTime(approval.requestedAt)}</time>
        </div>
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
            <code className="rounded border border-sentinel-line/70 bg-sentinel-canvas/80 px-1.5 py-0.5 font-mono text-[10px] text-sentinel-text">
              {approval.resource}
            </code>
          </dd>
        </div>
        {approval.requestedBy ? (
          <div>
            <dt>Requester</dt>
            <dd className="min-w-0 break-words [overflow-wrap:anywhere] flex items-center gap-1 text-sentinel-text font-medium">
              <User className="h-2.5 w-2.5 text-sentinel-muted shrink-0" />
              <span className="truncate">{approval.requestedBy}</span>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Context</dt>
          <dd className="min-w-0 break-words [overflow-wrap:anywhere]">
            {approval.context}
          </dd>
        </div>
      </dl>

      {(detailed || expanded) && (
        <div className="mb-3 rounded-lg border border-sentinel-line/60 bg-sentinel-canvas/60 p-2.5 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between text-sentinel-muted text-[10px]">
            <span className="font-semibold text-sentinel-text">Governance & Impact Assessment</span>
            <span className="font-mono text-[9px] text-sentinel-muted">UUID: {approval.id}</span>
          </div>
          <p className="text-sentinel-muted leading-relaxed text-[10px]">
            Zero-trust policy engine intercepted this mutation because target <span className="font-mono font-medium text-sentinel-text">{approval.resource}</span> contains production-impacting permissions. Execution remains paused until an authorized reviewer signs off.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-sentinel-line/40">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[11px] font-medium text-sentinel-muted hover:text-sentinel-text"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          <span>{expanded ? "Less details" : "More details"}</span>
        </button>
      </div>

      <div className="approval-actions mt-3">
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
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("sentinelops_hide_launch_checklist");
      if (saved === "true") {
        setIsDismissed(true);
      }
    } catch {
      // Ignore localStorage access errors
    }
  }, []);

  const toggleDismissed = () => {
    const next = !isDismissed;
    setIsDismissed(next);
    try {
      localStorage.setItem("sentinelops_hide_launch_checklist", String(next));
    } catch {
      // Ignore localStorage write errors
    }
  };

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

  if (mounted && isDismissed) {
    return (
      <div className="mb-5 flex items-center justify-between rounded-xl border border-sentinel-line/80 bg-sentinel-surface/60 px-4 py-2.5 text-xs text-sentinel-muted shadow-sm transition-all duration-200">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sentinel-lime/10 text-sentinel-lime">
            <ClipboardCheck className="h-3.5 w-3.5" />
          </span>
          <span className="font-medium text-sentinel-text">Workspace launch checklist</span>
          <span className="rounded-full border border-sentinel-lime/30 bg-sentinel-lime/10 px-2 py-0.5 text-[10px] font-semibold text-sentinel-lime">
            {completeCount}/6 complete
          </span>
        </div>
        <button
          onClick={toggleDismissed}
          className="flex items-center gap-1.5 rounded-lg border border-sentinel-line bg-sentinel-canvas/70 px-2.5 py-1 text-xs font-semibold text-sentinel-lime transition-colors hover:border-sentinel-lime/40 hover:bg-sentinel-lime/10"
        >
          <Eye className="h-3.5 w-3.5" />
          Show checklist
        </button>
      </div>
    );
  }

  return (
    <section className="mb-5 rounded-app border border-sentinel-lime/25 bg-sentinel-lime/5 p-4 shadow-app-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-sentinel-text">Workspace launch checklist</p>
            <span className="rounded-full border border-sentinel-lime/30 bg-sentinel-lime/10 px-2.5 py-0.5 text-[10px] font-semibold text-sentinel-lime">
              {completeCount}/6 complete
            </span>
          </div>
          <p className="mt-1 text-xs text-sentinel-muted">Complete this path before connecting a production-impacting agent.</p>
        </div>
        <button
          onClick={toggleDismissed}
          className="flex items-center gap-1.5 rounded-lg border border-sentinel-line bg-sentinel-surface/80 px-2.5 py-1 text-xs font-medium text-sentinel-muted transition-colors hover:border-sentinel-line hover:text-sentinel-text"
          title="Hide workspace launch checklist"
        >
          <EyeOff className="h-3.5 w-3.5" />
          <span>Hide checklist</span>
        </button>
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

export function AgentActivityFeed({
  events,
  agents,
}: {
  events: AuditEvent[];
  agents: Agent[];
}) {
  const [filterQuery, setFilterQuery] = useState("");
  const [resultFilter, setResultFilter] = useState<string>("all");

  const agentEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesQuery =
        !filterQuery ||
        e.agent.toLowerCase().includes(filterQuery.toLowerCase()) ||
        e.action.toLowerCase().includes(filterQuery.toLowerCase()) ||
        e.detail.toLowerCase().includes(filterQuery.toLowerCase());
      const matchesResult =
        resultFilter === "all" || e.result.toLowerCase() === resultFilter.toLowerCase();
      return matchesQuery && matchesResult;
    });
  }, [events, filterQuery, resultFilter]);

  return (
    <div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sentinel-line/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sentinel-lime/10 text-sentinel-lime">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-sentinel-text">Live Agent Activity & Telemetry</h3>
            <p className="text-[11px] text-sentinel-muted">Real-time operational stream of autonomous actions, tool calls, and policy outcomes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sentinel-lime opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sentinel-lime"></span>
          </span>
          <span className="text-[11px] font-mono text-sentinel-lime font-medium">STREAMING LIVE</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {["all", "allowed", "blocked", "approved", "executing"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setResultFilter(tab)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${
                resultFilter === tab
                  ? "bg-sentinel-canvas text-sentinel-text shadow-sm border border-sentinel-line"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Filter agent or tool…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="h-7 w-48 rounded-lg border border-sentinel-line bg-sentinel-canvas/80 px-2.5 text-xs text-sentinel-text placeholder:text-sentinel-muted focus:border-sentinel-lime focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-3 max-h-[380px] overflow-y-auto divide-y divide-sentinel-line/40 rounded-lg border border-sentinel-line/60 bg-sentinel-canvas/40">
        {agentEvents.length === 0 ? (
          <div className="py-8 text-center text-xs text-sentinel-muted">
            No agent activity events matching criteria.
          </div>
        ) : (
          agentEvents.slice(0, 30).map((event) => {
            const isBlocked = event.result === "Blocked" || event.result === "Failed";
            const isApproved = event.result === "Approved" || event.result === "Allowed" || event.result === "Succeeded";
            const isExecuting = event.result === "Executing";

            return (
              <div key={event.id} className="flex items-start justify-between gap-3 p-2.5 text-xs hover:bg-sentinel-surface/50 transition-colors">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[10px] ${
                    isBlocked
                      ? "border-red-500/30 bg-red-500/10 text-red-500"
                      : isApproved
                      ? "border-sentinel-lime/30 bg-sentinel-lime/10 text-sentinel-lime"
                      : isExecuting
                      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-500 animate-pulse"
                      : "border-sentinel-line bg-sentinel-soft/20 text-sentinel-muted"
                  }`}>
                    {isBlocked ? <X className="h-3 w-3" /> : isApproved ? <Check className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sentinel-text truncate max-w-[160px]">{event.agent}</span>
                      <span className="rounded bg-sentinel-surface border border-sentinel-line px-1.5 py-0.2 font-mono text-[10px] text-sentinel-muted">
                        {event.action}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-sentinel-muted max-w-[450px]">
                      {event.detail}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider border ${
                    isBlocked
                      ? "border-red-500/30 bg-red-500/10 text-red-400"
                      : isApproved
                      ? "border-sentinel-lime/30 bg-sentinel-lime/10 text-sentinel-lime"
                      : isExecuting
                      ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400"
                      : "border-sentinel-line bg-sentinel-soft/20 text-sentinel-muted"
                  }`}>
                    {event.result}
                  </span>
                  <span className="font-mono text-[10px] text-sentinel-muted">
                    {displayTime(event.time)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
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
  const [dashboardTab, setDashboardTab] = useState<"fleet" | "activity">("fleet");
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

      {/* Executive Command Center Status Strip */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sentinel-line/80 bg-sentinel-surface/70 px-4 py-2.5 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sentinel-lime opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sentinel-lime"></span>
            </span>
            <span className="font-semibold text-sentinel-text">Policy Engine:</span>
            <span className="font-mono text-sentinel-lime font-medium">ACTIVE (Zero-Trust)</span>
          </div>
          <span className="hidden text-sentinel-line sm:inline">•</span>
          <div className="flex items-center gap-1.5 text-sentinel-muted">
            <Zap className="h-3.5 w-3.5 text-sentinel-lime" />
            <span>Evaluation Latency:</span>
            <span className="font-mono text-sentinel-text font-medium">&lt; 0.8ms</span>
          </div>
          <span className="hidden text-sentinel-line md:inline">•</span>
          <div className="flex items-center gap-1.5 text-sentinel-muted">
            <Shield className="h-3.5 w-3.5 text-sentinel-accent" />
            <span>Audit Integrity:</span>
            <span className="font-mono text-sentinel-text font-medium">SHA-256 Sealed</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-sentinel-line bg-sentinel-canvas/80 px-2.5 py-0.5 font-mono text-[11px] text-sentinel-muted">
            {live ? "Live Production" : "Interactive Demo"}
          </span>
        </div>
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
          detail={`${healthyAgents} healthy • ${agents.length - healthyAgents} under review`}
          badge="FLEET READY"
          badgeColor="text-sentinel-lime border-sentinel-lime/30 bg-sentinel-lime/10"
        />
        <Metric
          icon={ShieldCheck}
          label="Policy compliance"
          value={compliance}
          detail={
            policySummary.total
              ? `${policySummary.total} decisions verified in window`
              : "Zero violations recorded"
          }
          badge={compliance === "100.0%" ? "ZERO BREACH" : "ENFORCED"}
          badgeColor="text-sentinel-accent border-sentinel-accent/30 bg-sentinel-accent/10"
        />
        <Metric
          icon={ClipboardCheck}
          label="Pending approvals"
          value={String(approvals.length)}
          detail={approvals.length === 0 ? "Zero blocking actions" : "Human review requested"}
          badge={approvals.length > 0 ? "ACTION REQ" : "CLEAR"}
          badgeColor={approvals.length > 0 ? "text-amber-400 border-amber-400/30 bg-amber-400/10" : "text-sentinel-muted border-sentinel-line bg-sentinel-soft/20"}
        />
        <Metric
          icon={CircleDollarSign}
          label="Governed AI spend"
          value={money(totalSpend)}
          detail={`Across ${agents.length} registered agent${agents.length === 1 ? "" : "s"}`}
          badge="MONITORED"
          badgeColor="text-sentinel-muted border-sentinel-line bg-sentinel-soft/20"
        />
      </section>

      <div className="dashboard-grid">
        <div className="dashboard-main space-y-4">
          <div className="analytics-grid">
            <ActivityChart events={audit} live={live} fallbackData={chartData} />
            <RiskPosture events={audit} />
          </div>

          <div className="rounded-xl border border-sentinel-line bg-sentinel-surface/50 p-1">
            <div className="flex items-center justify-between border-b border-sentinel-line/60 px-3 py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDashboardTab("fleet")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    dashboardTab === "fleet"
                      ? "border border-sentinel-lime/40 bg-sentinel-lime/10 text-sentinel-lime shadow-sm"
                      : "text-sentinel-muted hover:text-sentinel-text"
                  }`}
                >
                  <Bot className="h-3.5 w-3.5" />
                  Agent Fleet
                  <span className="rounded-full bg-sentinel-canvas/80 px-1.5 py-0.2 font-mono text-[10px]">
                    {agents.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDashboardTab("activity")}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    dashboardTab === "activity"
                      ? "border border-sentinel-lime/40 bg-sentinel-lime/10 text-sentinel-lime shadow-sm"
                      : "text-sentinel-muted hover:text-sentinel-text"
                  }`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  Live Activity Telemetry
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sentinel-lime opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sentinel-lime"></span>
                  </span>
                </button>
              </div>
            </div>

            <div className="pt-2">
              {dashboardTab === "fleet" ? (
                <AgentTable agents={agents} compact auditLogs={audit} />
              ) : (
                <AgentActivityFeed events={audit} agents={agents} />
              )}
            </div>
          </div>
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
