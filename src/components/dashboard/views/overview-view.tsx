"use client";

import {
  Activity,
  ArrowRight,
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
  Cpu,
  ExternalLink,
  Eye,
  EyeOff,
  FileCheck,
  FileText,
  Filter,
  GitBranch,
  Layers,
  LoaderCircle,
  Lock,
  PlugZap,
  Plus,
  Radio,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Terminal,
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

export function MetricCard({
  icon: Icon,
  title,
  value,
  subtitle,
  badge,
  badgeColor = "text-sentinel-lime border-sentinel-lime/30 bg-sentinel-lime/10",
  meterPercent,
  meterColor = "bg-sentinel-lime",
}: {
  icon: typeof Bot;
  title: string;
  value: string;
  subtitle: string;
  badge?: string;
  badgeColor?: string;
  meterPercent?: number;
  meterColor?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-sentinel-line/80 bg-gradient-to-b from-sentinel-surface via-sentinel-surface/90 to-sentinel-surface/60 p-5 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-sentinel-lime/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sentinel-line bg-sentinel-canvas/80 text-sentinel-lime shadow-sm transition-transform duration-200 group-hover:scale-105">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-sentinel-muted">
              {title}
            </span>
            <div className="mt-0.5 font-mono text-2xl font-bold tracking-tight text-sentinel-text">
              {value}
            </div>
          </div>
        </div>
        {badge && (
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${badgeColor}`}
          >
            {badge}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 text-[11px] text-sentinel-muted">
        <span className="truncate">{subtitle}</span>
      </div>

      {meterPercent !== undefined && (
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-sentinel-canvas/70">
          <div
            className={`h-full rounded-full transition-all duration-500 ${meterColor}`}
            style={{ width: `${Math.min(100, Math.max(0, meterPercent))}%` }}
          />
        </div>
      )}
    </div>
  );
}

// Backward-compatible export for legacy tests
export const Metric = MetricCard;

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
  const padding = { left: 38, right: 12, top: 12, bottom: 24 };

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

  const areaPoints = (key: "allowed" | "approved" | "blocked") => {
    const bottomY = height - padding.bottom;
    const startX = padding.left;
    const endX = width - padding.right;
    const linePoints = data.map((item, index) => `${x(index)},${y(item[key])}`).join(" ");
    return `${startX},${bottomY} ${linePoints} ${endX},${bottomY}`;
  };

  return (
    <section className="panel chart-panel">
      <div className="section-heading">
        <div>
          <h2>Autonomous Actions & Interceptions</h2>
          <p>
            {timeRange === "24h"
              ? "Policy evaluations across the last 24 hours"
              : timeRange === "14d"
                ? "Policy evaluations across the last 14 days"
                : timeRange === "30d"
                  ? "Policy evaluations across the last 30 days"
                  : "Policy evaluations across the last 7 days"}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-sentinel-line bg-sentinel-canvas/70 p-0.5 text-xs">
          {(["24h", "7d", "14d", "30d"] as ActivityTimeRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                timeRange === range
                  ? "bg-sentinel-surface text-sentinel-lime shadow-sm"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
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
          aria-label="Activity chart showing allowed, approved, and blocked agent actions"
        >
          <defs>
            <linearGradient id="gradient-area-allowed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="gradient-area-approved" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="gradient-area-blocked" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines */}
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

          {/* Area Fills */}
          <polygon points={areaPoints("allowed")} fill="url(#gradient-area-allowed)" />
          <polygon points={areaPoints("approved")} fill="url(#gradient-area-approved)" />
          <polygon points={areaPoints("blocked")} fill="url(#gradient-area-blocked)" />

          {/* Lines */}
          <polyline points={points("allowed")} className="chart-line chart-line-allowed" />
          <polyline points={points("approved")} className="chart-line chart-line-approved" />
          <polyline points={points("blocked")} className="chart-line chart-line-blocked" />

          {/* Data Points */}
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

          {/* Bottom Day Labels */}
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

export function RiskPosture({
  events,
  onOpenPolicies,
}: {
  events: AuditEvent[];
  onOpenPolicies?: () => void;
}) {
  const blockedCount = events.filter((e) => e.result === "Blocked" || e.result === "Failed").length;
  const approvedCount = events.filter((e) => e.result === "Approved").length;

  return (
    <section className="panel risk-panel flex flex-col justify-between">
      <div>
        <div className="section-heading">
          <div>
            <h2>Live Risk Posture</h2>
            <p>Real-time intercept stream</p>
          </div>
          <span className="live-label"><span />Live</span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-lg border border-sentinel-line/60 bg-sentinel-canvas/60 p-2">
            <span className="text-[10px] text-sentinel-muted uppercase font-bold">Interceptions</span>
            <p className="mt-0.5 font-mono text-sm font-semibold text-red-500 dark:text-red-400">
              {blockedCount} Guarded
            </p>
          </div>
          <div className="rounded-lg border border-sentinel-line/60 bg-sentinel-canvas/60 p-2">
            <span className="text-[10px] text-sentinel-muted uppercase font-bold">Sign-offs</span>
            <p className="mt-0.5 font-mono text-sm font-semibold text-sentinel-lime">
              {approvedCount} Approved
            </p>
          </div>
        </div>

        <div className="risk-timeline">
          {events.slice(0, 4).map((event) => (
            <div className="risk-event" key={event.id}>
              <span className={`timeline-marker marker-${event.result.toLowerCase()}`}>
                {event.result === "Blocked" || event.result === "Failed" ? (
                  <ShieldAlert />
                ) : (
                  <Check />
                )}
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
      </div>

      {onOpenPolicies && (
        <button
          type="button"
          onClick={onOpenPolicies}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-sentinel-line bg-sentinel-canvas/80 py-1.5 text-xs font-semibold text-sentinel-lime transition-colors hover:border-sentinel-lime/40 hover:bg-sentinel-lime/10"
        >
          <Shield className="h-3.5 w-3.5" />
          <span>Configure Zero-Trust Policies</span>
        </button>
      )}
    </section>
  );
}

export function ApprovalCard({
  approval,
  onDecision,
  canDecide,
  compact = false,
  detailed = false,
}: {
  approval: Approval;
  onDecision: (approval: Approval, decision: "approved" | "denied") => Promise<void>;
  canDecide: boolean;
  compact?: boolean;
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
      // Ignore clipboard write error
    }
  };

  const isHighRisk = approval.risk === "high";

  // Optimized compact rendering for sidebars and 320px rails
  if (compact) {
    return (
      <article
        className={`rounded-xl border p-3 transition-all duration-200 ${
          isHighRisk
            ? "border-red-500/40 bg-gradient-to-b from-red-500/[0.06] to-sentinel-surface/90 shadow-sm"
            : "border-sentinel-line/80 bg-sentinel-surface hover:border-sentinel-line"
        }`}
      >
        {/* Header: Risk + Timestamp */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Risk risk={approval.risk} />
            {isHighRisk && (
              <span className="rounded bg-red-500/15 px-1.5 py-0.2 text-[9px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wider">
                Sign-off
              </span>
            )}
          </div>
          <time className="font-mono text-[10px] text-sentinel-muted">
            {displayTime(approval.requestedAt)}
          </time>
        </div>

        {/* Agent Info & Request */}
        <div className="mt-2.5 flex items-start gap-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-sentinel-line bg-sentinel-canvas text-sentinel-lime">
            {approval.agentName.includes("GitHub") ? (
              <GitBranch className="h-3 w-3" />
            ) : (
              <Bot className="h-3 w-3" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-xs text-sentinel-text truncate">
              {approval.agentName}
            </div>
            <p className="text-[11px] text-sentinel-muted truncate mt-0.5">
              {approval.request}
            </p>
          </div>
        </div>

        {/* Target Resource Box */}
        <div className="mt-2 rounded-lg border border-sentinel-line/70 bg-sentinel-canvas/70 px-2.5 py-1.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-sentinel-muted">
            Target Resource
          </div>
          <code className="block font-mono text-[10px] text-sentinel-text truncate mt-0.5" title={approval.resource}>
            {approval.resource}
          </code>
        </div>

        {/* Context Snippet */}
        <p className="mt-2 text-[11px] leading-relaxed text-sentinel-muted line-clamp-2" title={approval.context}>
          {approval.context}
        </p>

        {approval.requestedBy && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-sentinel-muted truncate">
            <User className="h-3 w-3 shrink-0 text-sentinel-muted" />
            <span className="truncate">Requester: {approval.requestedBy}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-sentinel-line/40">
          <button
            type="button"
            className="primary-button py-1.5 text-xs justify-center gap-1.5"
            disabled={!canDecide || Boolean(pendingDecision)}
            onClick={() => void submitDecision("approved")}
          >
            {pendingDecision === "approved" ? (
              <LoaderCircle className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            <span>{pendingDecision === "approved" ? "Approving…" : "Approve"}</span>
          </button>
          <button
            type="button"
            className="secondary-button py-1.5 text-xs justify-center gap-1.5"
            disabled={!canDecide || Boolean(pendingDecision)}
            onClick={() => void submitDecision("denied")}
          >
            {pendingDecision === "denied" ? (
              <LoaderCircle className="h-3 w-3 animate-spin" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            <span>{pendingDecision === "denied" ? "Denying…" : "Deny"}</span>
          </button>
        </div>
      </article>
    );
  }

  // Full detailed card for 3-column /approvals page
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
          <dd className={`min-w-0 break-words [overflow-wrap:anywhere] ${expanded ? "" : "line-clamp-2"}`} title={approval.context}>
            {approval.context}
          </dd>
        </div>
      </dl>

      {expanded && (
        <div className="mb-3 rounded-lg border border-sentinel-line/60 bg-sentinel-canvas/70 p-3 text-[11px] space-y-2">
          <div className="flex items-center justify-between text-sentinel-muted text-[10px]">
            <span className="font-semibold text-sentinel-text">Governance & Impact Assessment</span>
            <span className="font-mono text-[9px] text-sentinel-muted">UUID: {approval.id}</span>
          </div>
          <p className="text-sentinel-muted leading-relaxed text-[10px]">
            Zero-trust policy engine intercepted this mutation because target <span className="font-mono font-medium text-sentinel-text">{approval.resource}</span> contains production-impacting permissions. Execution remains paused until an authorized reviewer signs off.
          </p>
          <div className="pt-2 border-t border-sentinel-line/40 text-[10px] text-sentinel-muted flex items-center justify-between">
            <span>Trigger: Production Mutation Policy</span>
            <span className="font-mono text-amber-500 dark:text-amber-400 font-medium">Status: Awaiting Human Sign-Off</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-sentinel-line/40">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-semibold text-sentinel-lime hover:underline cursor-pointer"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span>{expanded ? "Hide details" : "Show details"}</span>
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
      <div className="approval-list space-y-3">
        {approvals.length ? (
          approvals.slice(0, 3).map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onDecision={onDecision}
              canDecide={canDecide}
              compact={true}
            />
          ))
        ) : (
          <EmptyState
            icon={CheckCircle2}
            title="Queue cleared"
            description="There are no actions waiting for human review."
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
  const [operationsTab, setOperationsTab] = useState<"fleet" | "activity" | "security">("fleet");
  const totalSpend = agents.reduce((sum, agent) => sum + agent.cost, 0);
  const healthyAgents = agents.filter((agent) => agent.status === "healthy").length;
  const policySummary = useMemo(() => summarizePolicyDecisions(audit), [audit]);
  const compliance =
    policySummary.compliancePercent === null
      ? "100.0%"
      : `${policySummary.compliancePercent.toFixed(1)}%`;

  const healthyRatio = agents.length > 0 ? (healthyAgents / agents.length) * 100 : 100;
  const complianceRatio = policySummary.compliancePercent ?? 100;

  return (
    <main className="page overview-page">
      {/* Executive Command Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sentinel-line/90 bg-gradient-to-r from-sentinel-surface via-sentinel-surface-raised/40 to-sentinel-surface p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-sentinel-lime/30 bg-sentinel-lime/10 px-2 py-0.5 font-mono text-[10px] font-bold text-sentinel-lime uppercase tracking-wider">
              {operator?.organizationName || "SentinelOps Defense"}
            </span>
            <span className="rounded-md border border-sentinel-line bg-sentinel-canvas/80 px-2 py-0.5 font-mono text-[10px] text-sentinel-muted uppercase">
              {operator?.role || "Admin"} Operator
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-sentinel-text">
            {operator ? `Welcome back, ${operator.displayName}` : "SentinelOps AI Control Center"}
          </h1>
          <p className="text-xs text-sentinel-muted">
            {live
              ? "Autonomous AI workforce governance, zero-trust policy enforcement, and audit ledger."
              : "Explore the AI governance control center in demo mode."}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onRegister}
            className="primary-button flex items-center gap-2 shadow-sm shadow-sentinel-lime/20"
          >
            <Bot className="h-4 w-4" />
            <span>Register Agent</span>
          </button>
          <button
            type="button"
            onClick={onOpenPolicies}
            className="secondary-button flex items-center gap-2"
          >
            <Shield className="h-4 w-4 text-sentinel-lime" />
            <span>Policies</span>
          </button>
          <button
            type="button"
            onClick={onOpenIntegrations}
            className="secondary-button flex items-center gap-2"
          >
            <PlugZap className="h-4 w-4 text-sentinel-muted" />
            <span>Integrations</span>
          </button>
        </div>
      </div>

      {/* System Health Status Bar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sentinel-line/80 bg-sentinel-surface/70 px-4 py-2.5 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sentinel-lime opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sentinel-lime"></span>
            </span>
            <span className="font-semibold text-sentinel-text">Policy Engine:</span>
            <span className="font-mono text-sentinel-lime font-semibold">ACTIVE (Zero-Trust)</span>
          </div>
          <span className="hidden text-sentinel-line sm:inline">•</span>
          <div className="flex items-center gap-1.5 text-sentinel-muted">
            <Zap className="h-3.5 w-3.5 text-sentinel-lime" />
            <span>Evaluation SLA:</span>
            <span className="font-mono text-sentinel-text font-medium">&lt; 0.8ms</span>
          </div>
          <span className="hidden text-sentinel-line md:inline">•</span>
          <div className="flex items-center gap-1.5 text-sentinel-muted">
            <Shield className="h-3.5 w-3.5 text-sentinel-accent" />
            <span>Audit Chain:</span>
            <span className="font-mono text-sentinel-text font-medium">SHA-256 Tamper-Proof</span>
          </div>
          <span className="hidden text-sentinel-line lg:inline">•</span>
          <div className="flex items-center gap-1.5 text-sentinel-muted">
            <ClipboardCheck className="h-3.5 w-3.5 text-sentinel-lime" />
            <span>Human Gateway:</span>
            <span className="font-mono text-sentinel-text font-medium">Enforcing Sign-Offs</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-sentinel-line bg-sentinel-canvas/80 px-2.5 py-0.5 font-mono text-[11px] text-sentinel-muted">
            {live ? "Live Production Workspace" : "Interactive Demo Preview"}
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

      {/* Modern 4-Card KPI Metric Deck */}
      <section className="mb-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Bot}
          title="Active Fleet"
          value={String(agents.length)}
          subtitle={`${healthyAgents} Healthy • ${agents.length - healthyAgents} Under Review`}
          badge="FLEET READY"
          badgeColor="text-sentinel-lime border-sentinel-lime/30 bg-sentinel-lime/10"
          meterPercent={healthyRatio}
          meterColor="bg-sentinel-lime"
        />
        <MetricCard
          icon={ShieldCheck}
          title="Policy Enforcement"
          value={compliance}
          subtitle={
            policySummary.total
              ? `${policySummary.total} evaluations verified in window`
              : "Zero violations recorded"
          }
          badge={compliance === "100.0%" ? "ZERO BREACH" : "ENFORCED"}
          badgeColor="text-sentinel-accent border-sentinel-accent/30 bg-sentinel-accent/10"
          meterPercent={complianceRatio}
          meterColor="bg-sentinel-accent"
        />
        <MetricCard
          icon={ClipboardCheck}
          title="Consequential Gate"
          value={String(approvals.length)}
          subtitle={
            approvals.length === 0
              ? "Zero blocking bottlenecks"
              : `${approvals.length} action${approvals.length === 1 ? "" : "s"} awaiting sign-off`
          }
          badge={approvals.length > 0 ? "ACTION REQ" : "CLEAR"}
          badgeColor={
            approvals.length > 0
              ? "text-amber-400 border-amber-400/30 bg-amber-400/10"
              : "text-sentinel-muted border-sentinel-line bg-sentinel-soft/20"
          }
          meterPercent={approvals.length > 0 ? 35 : 100}
          meterColor={approvals.length > 0 ? "bg-amber-400" : "bg-sentinel-lime"}
        />
        <MetricCard
          icon={CircleDollarSign}
          title="Compute Budget"
          value={money(totalSpend)}
          subtitle={`Across ${agents.length} agent${agents.length === 1 ? "" : "s"} • Run rate on target`}
          badge="MONITORED"
          badgeColor="text-sentinel-muted border-sentinel-line bg-sentinel-soft/20"
          meterPercent={72}
          meterColor="bg-sentinel-muted"
        />
      </section>

      {/* Main Operational Dashboard Grid */}
      <div className="dashboard-grid">
        <div className="dashboard-main space-y-5">
          {/* Analytics Line Chart & Threat Posture */}
          <div className="analytics-grid">
            <ActivityChart events={audit} live={live} fallbackData={chartData} />
            <RiskPosture events={audit} onOpenPolicies={onOpenPolicies} />
          </div>

          {/* Unified Operations Hub (Tabbed Container) */}
          <div className="rounded-2xl border border-sentinel-line/90 bg-sentinel-surface p-2 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sentinel-line/60 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOperationsTab("fleet")}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    operationsTab === "fleet"
                      ? "border border-sentinel-lime/40 bg-sentinel-lime/10 text-sentinel-lime shadow-sm"
                      : "text-sentinel-muted hover:text-sentinel-text"
                  }`}
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>Fleet Roster</span>
                  <span className="rounded-full bg-sentinel-canvas/80 px-1.5 py-0.2 font-mono text-[10px]">
                    {agents.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOperationsTab("activity")}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    operationsTab === "activity"
                      ? "border border-sentinel-lime/40 bg-sentinel-lime/10 text-sentinel-lime shadow-sm"
                      : "text-sentinel-muted hover:text-sentinel-text"
                  }`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Live Telemetry Stream</span>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sentinel-lime opacity-75"></span>
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sentinel-lime"></span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOperationsTab("security")}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    operationsTab === "security"
                      ? "border border-sentinel-lime/40 bg-sentinel-lime/10 text-sentinel-lime shadow-sm"
                      : "text-sentinel-muted hover:text-sentinel-text"
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>Security & Policy Gate</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-sentinel-muted">
                <span className="hidden sm:inline">Engine Status:</span>
                <span className="flex items-center gap-1 font-mono font-medium text-sentinel-lime">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Zero-Trust Enforced
                </span>
              </div>
            </div>

            {/* Tab View Content */}
            <div className="pt-2">
              {operationsTab === "fleet" && (
                <AgentTable agents={agents} compact auditLogs={audit} />
              )}
              {operationsTab === "activity" && (
                <AgentActivityFeed events={audit} agents={agents} />
              )}
              {operationsTab === "security" && (
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-sentinel-line/80 bg-sentinel-canvas/60 p-3.5">
                      <div className="flex items-center gap-2 text-sentinel-lime">
                        <ShieldCheck className="h-4 w-4" />
                        <span className="text-xs font-semibold">Strict Guardrails</span>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-sentinel-muted">
                        All autonomous mutations targeting production databases, external email/Slack, or cloud infrastructure require explicit human confirmation.
                      </p>
                    </div>
                    <div className="rounded-xl border border-sentinel-line/80 bg-sentinel-canvas/60 p-3.5">
                      <div className="flex items-center gap-2 text-sentinel-accent">
                        <Lock className="h-4 w-4" />
                        <span className="text-xs font-semibold">Secret Isolation</span>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-sentinel-muted">
                        Agent credentials and API keys are scoped to least-privilege tokens with cryptographic hash verification and rotation tracking.
                      </p>
                    </div>
                    <div className="rounded-xl border border-sentinel-line/80 bg-sentinel-canvas/60 p-3.5">
                      <div className="flex items-center gap-2 text-sentinel-lime">
                        <FileCheck className="h-4 w-4" />
                        <span className="text-xs font-semibold">Immutable Audit Trail</span>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-sentinel-muted">
                        Every action, decision, and evaluation is recorded with SHA-256 integrity chains, meeting SOC 2, ISO 27001, and EU AI Act standards.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-sentinel-lime/30 bg-sentinel-lime/5 p-4">
                    <div>
                      <h4 className="text-xs font-bold text-sentinel-text uppercase tracking-wider">
                        Configure Zero-Trust Policy Rules
                      </h4>
                      <p className="mt-0.5 text-xs text-sentinel-muted">
                        Customize policy simulation, automated blocking thresholds, and approver escalation paths.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenPolicies}
                      className="primary-button flex items-center gap-2 text-xs"
                    >
                      <Shield className="h-3.5 w-3.5" />
                      <span>Open Policy Engine</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar Approval Rail */}
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
