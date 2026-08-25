"use client";

import {
  Activity,
  ArrowDownToLine,
  Bell,
  Bot,
  Boxes,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Command,
  FileClock,
  FileKey2,
  Filter,
  ExternalLink,
  GitBranch,
  KeyRound,
  LayoutDashboard,
  LogOut,
  LockKeyhole,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  PlugZap,
  Plus,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
  Webhook,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  agents as initialAgents,
  approvals as initialApprovals,
  auditEvents as initialAuditEvents,
  chartData,
  integrations,
  policies as initialPolicies,
} from "@/lib/demo-data";
import {
  buildActivityChartData,
  summarizePolicyDecisions,
  type ActivityPoint,
  type ActivityTimeRange,
} from "@/lib/dashboard-metrics";
import { MfaVerificationDialog } from "@/components/mfa-verification-dialog";
import { PythonSDKConnection } from "@/components/python-sdk-connection";
import type {
  ActionDetail,
  Agent,
  AgentStatus,
  Approval,
  AuditEvent,
  Integration,
  OperatorIdentity,
  Policy,
  PolicyActivationRequest,
  ReleaseGovernanceQueueItem,
  RiskLevel,
} from "@/lib/types";
import { OperatorManagement } from "@/components/operator-management";
import { PasswordChangeDialog } from "@/components/password-change-dialog";
import { ApiKeyManagement } from "@/components/api-key-management";
import { PolicyEditorDialog } from "@/components/policy-editor-dialog";
import {
  PolicyActivationQueue,
  PolicyHistoryDialog,
} from "@/components/policy-governance";
import { ReleaseGovernanceQueue } from "@/components/release-governance-queue";
import { GitHubDriftIncidents } from "@/components/github-drift-incidents";
import { GitHubAppConnection } from "@/components/github-app-connection";
import { SlackConnection } from "@/components/slack-connection";
import { HttpsWebhookConnection } from "@/components/https-webhook-connection";
import { TablePagination } from "@/components/table-pagination";
import { CommandPalette } from "@/components/command-palette";
import { NotificationPopover } from "@/components/notification-popover";
import { RequestIntegrationDialog } from "@/components/request-integration-dialog";
import { AwsConnection } from "@/components/aws-connection";
import { MicrosoftConnection } from "@/components/microsoft-connection";
import { ThemeToggle } from "@/components/theme-toggle";
import { AgentDetailDrawer } from "@/components/agent-detail-drawer";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { PolicySimulationPanel } from "@/components/policy-simulation-panel";
import { ToastNotification, type ToastData } from "@/components/toast-notification";

export type DashboardView =
  | "overview"
  | "agents"
  | "approvals"
  | "policies"
  | "audit"
  | "integrations"
  | "credentials"
  | "team";

type WorkspaceMode = "demo" | "connecting" | "live";

interface LiveControlCenterPayload {
  mode: "live";
  operator: OperatorIdentity;
  agents: Agent[];
  approvals: Approval[];
  policies: Policy[];
  policyActivations: PolicyActivationRequest[];
  releaseGovernance: ReleaseGovernanceQueueItem[];
  audit: AuditEvent[];
  integrations: Integration[];
}

const navItems: Array<{
  id: DashboardView;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "approvals", label: "Approvals", icon: ClipboardCheck },
  { id: "policies", label: "Policies", icon: Shield },
  { id: "audit", label: "Audit log", icon: FileClock },
  { id: "integrations", label: "Integrations", icon: PlugZap },
  { id: "credentials", label: "Credentials", icon: KeyRound, adminOnly: true },
  { id: "team", label: "Team access", icon: UsersRound, adminOnly: true },
];

const titles: Record<DashboardView, string> = {
  overview: "Control center",
  agents: "Agent registry",
  approvals: "Approval queue",
  policies: "Policy engine",
  audit: "Audit log",
  integrations: "Integrations",
  credentials: "Agent credentials",
  team: "Team access",
};

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusLabel(status: AgentStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function executionLabel(status: Agent["lastExecutionStatus"]) {
  if (!status || status === "not_started") return null;
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function parseEventTimestamp(value: string, referenceTime = Date.now()): number {
  if (!value) return NaN;
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) {
    return direct;
  }
  if (/^\d{10,13}$/.test(value)) {
    const num = Number(value);
    return value.length === 10 ? num * 1000 : num;
  }
  const timeMatch = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const meridiem = timeMatch[4]?.toUpperCase();

    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    const d = new Date(referenceTime);
    d.setHours(hours, minutes, seconds, 0);
    return d.getTime();
  }
  return NaN;
}

function displayTime(value: string) {
  const timestamp = parseEventTimestamp(value);
  if (Number.isNaN(timestamp)) return value;
  const date = new Date(timestamp);
  const isToday = new Date().toDateString() === date.toDateString();
  if (isToday) {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Status({ status }: { status: AgentStatus }) {
  if (status === "quarantined") {
    return (
      <span className="status status-blocked border-sentinel-red/40 bg-sentinel-red/15 text-red-300 font-semibold inline-flex items-center gap-1">
        <ShieldAlert className="h-3 w-3 text-red-400 shrink-0" />
        Quarantined
      </span>
    );
  }
  return (
    <span className={`status status-${status}`}>
      <span className="status-dot" />
      {statusLabel(status)}
    </span>
  );
}

function Risk({ risk }: { risk: RiskLevel }) {
  return (
    <span className={`risk risk-${risk}`}>
      <span className="risk-dot" />
      {risk} risk
    </span>
  );
}

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark ${small ? "brand-mark-small" : ""}`}>
      <ShieldCheck aria-hidden="true" />
    </span>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <Icon aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function TopBar({
  view,
  onMenu,
  operator,
  onChangePassword,
  onLogout,
  onOpenCommandPalette,
  onToggleNotifications,
  notificationsOpen,
  approvals = [],
  quarantinedAgents = [],
  onDecision,
  integrityVerified,
  onSelectView,
  canDecide = true,
}: {
  view: DashboardView;
  onMenu: () => void;
  operator: OperatorIdentity | null;
  onChangePassword: () => void;
  onLogout: () => void;
  onOpenCommandPalette: () => void;
  onToggleNotifications: () => void;
  notificationsOpen: boolean;
  approvals?: Approval[];
  quarantinedAgents?: Agent[];
  onDecision?: (approval: Approval, decision: "approved" | "denied") => Promise<void>;
  integrityVerified: boolean;
  onSelectView: (view: DashboardView) => void;
  canDecide?: boolean;
}) {
  const initials = operator?.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SO";
  return (
    <header className="topbar relative">
      <button className="icon-button menu-button" onClick={onMenu} aria-label="Open navigation">
        <Menu />
      </button>
      <h1>{titles[view]}</h1>
      <div className="topbar-actions">
        <button
          className="organization-control"
          onClick={() => onSelectView("team")}
          title="Manage organization & directory"
        >
          <Building2 />
          <span>{operator?.organizationName || "Aperture Labs"}</span>
          <ChevronDown />
        </button>
        <button
          className="command-control"
          onClick={onOpenCommandPalette}
          aria-label="Search or run command"
        >
          <Search />
          <span>Search or run command…</span>
          <kbd>
            <Command />K
          </kbd>
        </button>
        <ThemeToggle />
        <div className="relative">
          <button
            className={`icon-button notification-button ${notificationsOpen ? "bg-white/10 text-sentinel-lime" : ""}`}
            onClick={onToggleNotifications}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell />
            {(approvals.filter((a) => a.status === "pending").length > 0 || quarantinedAgents.length > 0) ? <span /> : null}
          </button>
          <NotificationPopover
            open={notificationsOpen}
            onClose={onToggleNotifications}
            approvals={approvals}
            onDecision={onDecision}
            quarantinedAgents={quarantinedAgents}
            integrityVerified={integrityVerified}
            onSelectView={onSelectView}
            canDecide={canDecide}
          />
        </div>
        <button
          className="profile-control"
          onClick={onChangePassword}
          disabled={!operator}
          aria-label={operator ? "Change your password" : "Operator profile"}
        >
          <span className="avatar">{initials}</span>
          <span className="profile-name">
            {operator?.displayName || "SentinelOps Operator"}
            {operator ? (
              <small className="ml-2 capitalize text-sentinel-muted">{operator.role}</small>
            ) : null}
          </span>
          <KeyRound aria-hidden="true" />
        </button>
        {operator ? (
          <button
            className="secondary-button topbar-logout flex items-center gap-1.5"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}

function Sidebar({
  view,
  open,
  collapsed,
  pendingCount,
  canManageOperators,
  onSelect,
  onClose,
  onToggleCollapse,
}: {
  view: DashboardView;
  open: boolean;
  collapsed: boolean;
  pendingCount: number;
  canManageOperators: boolean;
  onSelect: (view: DashboardView) => void;
  onClose: () => void;
  onToggleCollapse: () => void;
}) {
  return (
    <>
      {open && <button className="mobile-overlay" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}>
        <div className="brand">
          <BrandMark />
          {!collapsed ? (
            <span>
              Sentinel<strong>Ops</strong>
            </span>
          ) : null}
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="Close navigation">
            <X />
          </button>
        </div>
        <nav aria-label="Product navigation">
          {navItems.filter((item) => !item.adminOnly || canManageOperators).map((item) => {
            const Icon = item.icon;
            const selected = view === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${selected ? "nav-item-selected" : ""}`}
                onClick={() => {
                  onSelect(item.id);
                  onClose();
                }}
                title={collapsed ? item.label : undefined}
                aria-current={selected ? "page" : undefined}
              >
                <Icon />
                {!collapsed ? <span>{item.label}</span> : null}
                {item.id === "approvals" && pendingCount > 0 && (
                  <span className="nav-count">{pendingCount}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          {!collapsed ? (
            <div className="system-state">
              <span className="online-dot" />
              <div>
                <span>System status</span>
                <strong>All systems operational</strong>
              </div>
            </div>
          ) : null}
          <button
            className="collapse-control"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
}

function Metric({
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

function ActivityChart({
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
              <text x={0} y={y(value) + 3} className="chart-axis-label">{Math.round(value).toLocaleString()}</text>
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

function RiskPosture({ events }: { events: AuditEvent[] }) {
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
              <strong className="block max-w-full truncate" title={event.action}>{event.action}</strong>
              <span>{event.agent}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AgentTable({
  agents,
  compact = false,
  onQuarantine,
  onLiftQuarantine,
  auditLogs = [],
}: {
  agents: Agent[];
  compact?: boolean;
  onQuarantine?: (agent: Agent, reason: string) => Promise<void>;
  onLiftQuarantine?: (agent: Agent, reason: string) => Promise<void>;
  auditLogs?: AuditEvent[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | AgentStatus>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [quarantineTarget, setQuarantineTarget] = useState<Agent | null>(null);
  const [quarantineMode, setQuarantineMode] = useState<"quarantine" | "unquarantine">("quarantine");
  const [quarantineReason, setQuarantineReason] = useState("");
  const [quarantineBusy, setQuarantineBusy] = useState(false);
  const [quarantineError, setQuarantineError] = useState("");

  const filtered = agents.filter((agent) => {
    const matchesQuery =
      agent.name.toLowerCase().includes(query.toLowerCase()) ||
      agent.owner.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "all" || agent.status === status);
  });

  const paginatedAgents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, currentPage, pageSize]);

  async function handleConfirmQuarantine(e: React.FormEvent) {
    e.preventDefault();
    if (!quarantineTarget) return;
    setQuarantineBusy(true);
    setQuarantineError("");
    try {
      if (quarantineMode === "quarantine") {
        if (onQuarantine) await onQuarantine(quarantineTarget, quarantineReason);
      } else {
        if (onLiftQuarantine) await onLiftQuarantine(quarantineTarget, quarantineReason);
      }
      setQuarantineTarget(null);
      setQuarantineReason("");
    } catch (err) {
      setQuarantineError(err instanceof Error ? err.message : "Operation failed.");
    } finally {
      setQuarantineBusy(false);
    }
  }

  function handleExportCsv() {
    const headers = ["Name", "Status", "Owner", "Team", "Provider", "Permissions", "7d Actions", "MTD Cost ($)", "Last Action", "Last Seen"];
    const rows = filtered.map((agent) => [
      `"${(agent.name || "").replace(/"/g, '""')}"`,
      `"${(agent.status || "").replace(/"/g, '""')}"`,
      `"${(agent.owner || "").replace(/"/g, '""')}"`,
      `"${(agent.team || "").replace(/"/g, '""')}"`,
      `"${(agent.provider || "").replace(/"/g, '""')}"`,
      `"${(agent.permissions?.join("; ") || "").replace(/"/g, '""')}"`,
      agent.actions ?? 0,
      (agent.cost ?? 0).toFixed(2),
      `"${(agent.lastAction || "").replace(/"/g, '""')}"`,
      `"${(agent.lastSeen || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sentinelops-agents-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section className={`panel table-panel ${compact ? "table-panel-compact" : ""}`}>
      <div className="section-heading table-heading">
        <div>
          <h2>{compact ? "Agent activity" : "AI agent inventory"}</h2>
          {!compact && <p>Ownership, permissions, health, and recent activity</p>}
        </div>
        <div className="table-controls">
          <label className="search-field">
            <Search />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search agents…"
              aria-label="Search agents"
            />
          </label>
          <label className="select-field">
            <Filter />
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as "all" | AgentStatus);
                setCurrentPage(1);
              }}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="review">Review</option>
              <option value="blocked">Blocked</option>
              <option value="quarantined">Quarantined</option>
            </select>
          </label>
          <button
            className="icon-button bordered cursor-pointer"
            onClick={handleExportCsv}
            aria-label="Export agents as CSV"
            title="Export agents as CSV"
          >
            <ArrowDownToLine />
          </button>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Last action</th>
              <th>Permissions</th>
              <th>Actions (7d)</th>
              <th>Cost (MTD)</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {paginatedAgents.map((agent) => (
              <tr
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className="cursor-pointer transition hover:bg-sentinel-surface-raised"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedAgent(agent);
                  }
                }}
                title="Click to view detailed agent profile and telemetry"
              >
                <td>
                  <div className="agent-name-cell">
                    <span className="agent-icon"><Bot /></span>
                    <div>
                      <strong>{agent.name}</strong>
                      {!compact && <span>{agent.provider}</span>}
                    </div>
                  </div>
                </td>
                <td><Status status={agent.status} /></td>
                <td>
                  <div className="owner-cell">
                    <span>{agent.owner.split(" ").map((part) => part[0]).join("")}</span>
                    <div><strong>{agent.owner}</strong><small>{agent.team}</small></div>
                  </div>
                </td>
                <td>
                  <strong className="plain-strong">{agent.lastAction}</strong>
                  <small className="cell-subtext">{agent.lastSeen}</small>
                  {executionLabel(agent.lastExecutionStatus) ? (
                    <span
                      className={`mt-1 inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                        agent.lastExecutionStatus === "succeeded"
                          ? "border-sentinel-lime/30 bg-sentinel-lime/10 text-sentinel-lime"
                          : agent.lastExecutionStatus === "executing"
                            ? "border-sentinel-amber/30 bg-sentinel-amber/10 text-sentinel-amber"
                            : "border-red-400/30 bg-red-400/10 text-red-300"
                      }`}
                    >
                      {executionLabel(agent.lastExecutionStatus)}
                    </span>
                  ) : null}
                </td>
                <td>
                  <strong className="plain-strong">{agent.permissions[0]}</strong>
                  <small className="cell-subtext">{agent.permissions.length} scopes</small>
                </td>
                <td className="mono">{agent.actions.toLocaleString()}</td>
                <td className="mono">{money(agent.cost)}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {(onQuarantine || onLiftQuarantine) ? (
                    <div className="flex items-center justify-end gap-1.5">
                      {agent.status === "quarantined" ? (
                        <button
                          className="secondary-button text-xs py-1 px-2 text-sentinel-lime border-sentinel-lime/30"
                          onClick={() => {
                            setQuarantineTarget(agent);
                            setQuarantineMode("unquarantine");
                            setQuarantineReason("");
                            setQuarantineError("");
                          }}
                          title="Lift emergency quarantine"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" /> Lift
                        </button>
                      ) : (
                        <button
                          className="secondary-button text-xs py-1 px-2 text-sentinel-red border-sentinel-red/30 hover:bg-sentinel-red/10"
                          onClick={() => {
                            setQuarantineTarget(agent);
                            setQuarantineMode("quarantine");
                            setQuarantineReason("");
                            setQuarantineError("");
                          }}
                          title="Trigger Emergency Killswitch"
                        >
                          <ShieldAlert className="h-3.5 w-3.5 text-sentinel-red" /> Killswitch
                        </button>
                      )}
                    </div>
                  ) : (
                    <button className="icon-button row-action" aria-label={`More actions for ${agent.name}`}><MoreHorizontal /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <EmptyState icon={Search} title="No agents found" description="Try a different name or status filter." />
      )}
      <TablePagination
        currentPage={currentPage}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        itemLabel="agents"
      />

      {quarantineTarget ? (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setQuarantineTarget(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-app-lg border border-sentinel-line-strong bg-sentinel-surface shadow-app-2"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between border-b border-sentinel-line px-6 py-5">
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl border ${
                    quarantineMode === "quarantine"
                      ? "border-sentinel-red/30 bg-sentinel-red/10 text-sentinel-red"
                      : "border-sentinel-lime/30 bg-sentinel-lime/10 text-sentinel-lime"
                  }`}
                >
                  {quarantineMode === "quarantine" ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                </span>
                <div>
                  <h2 className="text-base font-semibold text-sentinel-text">
                    {quarantineMode === "quarantine"
                      ? `Emergency Killswitch: ${quarantineTarget.name}`
                      : `Lift Quarantine: ${quarantineTarget.name}`}
                  </h2>
                  <p className="text-xs text-sentinel-muted">
                    {quarantineMode === "quarantine"
                      ? "Instantly halts all pending evaluations and revokes execution authority."
                      : "Restores normal policy evaluation and removes emergency hold."}
                  </p>
                </div>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text"
                onClick={() => setQuarantineTarget(null)}
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmQuarantine} className="space-y-4 px-6 py-5">
              <label className="block text-xs font-medium text-sentinel-muted">
                {quarantineMode === "quarantine" ? "Incident / Killswitch Justification" : "Restoration Justification"}
                <textarea
                  className="mt-2 min-h-[80px] w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 py-2.5 text-xs text-sentinel-text outline-none transition focus:border-sentinel-lime/70 focus:ring-2 focus:ring-sentinel-lime/10"
                  placeholder={
                    quarantineMode === "quarantine"
                      ? "e.g. Rogue autonomous execution loop detected in production"
                      : "e.g. Prompt injection vulnerability patched and regression verified"
                  }
                  value={quarantineReason}
                  onChange={(e) => setQuarantineReason(e.target.value)}
                  required
                  autoFocus
                />
              </label>

              {quarantineError ? (
                <div className="rounded-lg border border-sentinel-red/30 bg-sentinel-red/10 p-3 text-xs text-red-200">
                  {quarantineError}
                </div>
              ) : null}

              <div className="flex justify-end gap-3 border-t border-sentinel-line pt-4">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setQuarantineTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quarantineBusy || quarantineReason.trim().length < 3}
                  className={`primary-button ${
                    quarantineMode === "quarantine"
                      ? "bg-sentinel-red hover:bg-red-600 border-red-500 text-white"
                      : ""
                  }`}
                >
                  {quarantineBusy ? (
                    <LoaderCircle className="animate-spin" />
                  ) : quarantineMode === "quarantine" ? (
                    <ShieldAlert />
                  ) : (
                    <ShieldCheck />
                  )}
                  {quarantineMode === "quarantine" ? "Activate Killswitch" : "Restore Agent"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <AgentDetailDrawer
        agent={selectedAgent}
        open={Boolean(selectedAgent)}
        onClose={() => setSelectedAgent(null)}
        onQuarantine={(a) => {
          setQuarantineTarget(a);
          setQuarantineMode("quarantine");
          setQuarantineReason("");
          setQuarantineError("");
          setSelectedAgent(null);
        }}
        onLiftQuarantine={(a) => {
          setQuarantineTarget(a);
          setQuarantineMode("unquarantine");
          setQuarantineReason("");
          setQuarantineError("");
          setSelectedAgent(null);
        }}
        onExportAudit={handleExportCsv}
        auditLogs={auditLogs}
      />
    </section>
  );
}

function ApprovalCard({
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
        <span className="agent-icon">{approval.agentName.includes("GitHub") ? <GitBranch /> : <Bot />}</span>
        <div><strong>{approval.agentName}</strong><span>{approval.request}</span></div>
      </div>
      <dl>
        <div><dt>Resource</dt><dd className="min-w-0 break-words [overflow-wrap:anywhere]" title={approval.resource}>{approval.resource}</dd></div>
        <div><dt>Context</dt><dd className="min-w-0 break-words [overflow-wrap:anywhere]">{approval.context}</dd></div>
      </dl>
      <div className="approval-actions">
        <button className="primary-button" disabled={!canDecide || Boolean(pendingDecision)} onClick={() => void submitDecision("approved")}>
          {pendingDecision === "approved" ? <LoaderCircle className="animate-spin" /> : <Check />}
          {pendingDecision === "approved" ? "Approving…" : "Approve"}
        </button>
        <button className="secondary-button" disabled={!canDecide || Boolean(pendingDecision)} onClick={() => void submitDecision("denied")}>
          {pendingDecision === "denied" ? <LoaderCircle className="animate-spin" /> : <XCircle />}
          {pendingDecision === "denied" ? "Denying…" : "Deny"}
        </button>
      </div>
    </article>
  );
}

function ApprovalRail({
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
        <div><h2>Approval queue <span>{approvals.length}</span></h2><p>Human review required</p></div>
        <button className="text-button" onClick={onViewAll}>View all</button>
      </div>
      <div className="approval-list">
        {approvals.length ? (
          approvals.slice(0, 3).map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} onDecision={onDecision} canDecide={canDecide} />
          ))
        ) : (
          <EmptyState icon={CheckCircle2} title="Queue cleared" description="There are no actions waiting for review." />
        )}
      </div>
    </aside>
  );
}

function Overview({
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
  const compliance = policySummary.compliancePercent === null
    ? "—"
    : `${policySummary.compliancePercent.toFixed(1)}%`;
  return (
    <main className="page overview-page">
      <div className="page-title-row">
        <div>
          <h2>{operator ? `Welcome, ${operator.displayName}` : "Welcome to SentinelOps"}</h2>
          <p>{live ? "Your live AI workforce and governance activity." : "Explore the AI governance control center in demo mode."}</p>
        </div>
        <button className="primary-button primary-large" onClick={onRegister}>
          <Bot /> Register agent
        </button>
      </div>
      {live ? <PilotReadiness agents={agents} audit={audit} policyDecisions={policySummary.total} onRegister={onRegister} onOpenCredentials={onOpenCredentials} onOpenIntegrations={onOpenIntegrations} onOpenPolicies={onOpenPolicies} /> : null}
      <section className="metrics-band">
        <Metric icon={Bot} label="Registered agents" value={String(agents.length)} detail={`${healthyAgents} healthy`} />
        <Metric icon={ShieldCheck} label="Policy compliance" value={compliance} detail={policySummary.total ? `${policySummary.total} decisions in the current audit window` : "No policy decisions yet"} />
        <Metric icon={ClipboardCheck} label="Pending approvals" value={String(approvals.length)} detail="Requires review" />
        <Metric icon={CircleDollarSign} label="Recorded AI spend" value={money(totalSpend)} detail={`Across ${agents.length} registered agent${agents.length === 1 ? "" : "s"}`} />
      </section>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <div className="analytics-grid">
            <ActivityChart events={audit} live={live} fallbackData={chartData} />
            <RiskPosture events={audit} />
          </div>
          <AgentTable agents={agents} compact auditLogs={audit} />
        </div>
        <ApprovalRail approvals={approvals} onDecision={onDecision} onViewAll={onViewApprovals} canDecide={canDecide} />
      </div>
    </main>
  );
}

function PilotReadiness({
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
    { complete: mfaProtected, title: "Secure your workspace", detail: "Use MFA and keep the first administrator account protected.", action: onOpenCredentials, actionLabel: "Open credentials" },
    { complete: githubConnected, title: "Connect GitHub", detail: "Install the GitHub App for only the repositories this organization governs.", action: onOpenIntegrations, actionLabel: "Open integrations" },
    { complete: agentRegistered, title: "Register an owned agent", detail: "Assign an accountable owner and keep permissions locked by default.", action: onRegister, actionLabel: "Register agent" },
    { complete: agentExercised, title: "Create and exercise a credential", detail: "Run the low-risk connection check before a consequential action.", action: onOpenCredentials, actionLabel: "Open credentials" },
    { complete: policyDecisions > 0, title: "Verify a policy decision", detail: "Send the first governed evaluation and inspect its audit evidence.", action: onOpenPolicies, actionLabel: "Review policies" },
    { complete: policyDecisions > 0, title: "Review the first action", detail: "Confirm the recorded decision and tamper-evident evidence in the audit log.", action: onOpenCredentials, actionLabel: "View quickstart" },
  ];
  const completeCount = steps.filter((step) => step.complete).length;
  return <section className="mb-5 rounded-app border border-sentinel-lime/25 bg-sentinel-lime/5 p-4 shadow-app-1"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-sentinel-text">Workspace launch checklist</p><p className="mt-1 text-xs text-sentinel-muted">Complete this path before connecting a production-impacting agent.</p></div><span className="rounded-full border border-sentinel-lime/30 px-2.5 py-1 text-[10px] font-semibold text-sentinel-lime">{completeCount}/6 complete</span></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{steps.map((step, index) => <div key={step.title} className="rounded-xl border border-sentinel-line bg-sentinel-surface/70 p-3"><div className="flex items-start gap-2"><span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${step.complete ? "border-sentinel-lime/40 bg-sentinel-lime/10 text-sentinel-lime" : "border-sentinel-line text-sentinel-muted"}`}>{step.complete ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px]">{index + 1}</span>}</span><div className="min-w-0"><p className="text-xs font-semibold text-sentinel-text">{step.title}</p><p className="mt-1 text-[11px] leading-5 text-sentinel-muted">{step.detail}</p></div></div>{step.complete ? <p className="mt-3 text-[11px] font-medium text-sentinel-lime">Complete</p> : <button className="mt-3 text-xs font-semibold text-sentinel-lime" onClick={step.action}>{step.actionLabel}</button>}</div>)}</div></section>;
}

function AgentsView({
  agents,
  audit = [],
  onRegister,
  onQuarantine,
  onLiftQuarantine,
}: {
  agents: Agent[];
  audit?: AuditEvent[];
  onRegister: () => void;
  onQuarantine?: (agent: Agent, reason: string) => Promise<void>;
  onLiftQuarantine?: (agent: Agent, reason: string) => Promise<void>;
}) {
  return (
    <main className="page">
      <div className="page-title-row">
        <div><h2>AI agent inventory</h2><p>Every autonomous system, owner, permission, and health signal in one place.</p></div>
        <button className="primary-button primary-large" onClick={onRegister}><Plus /> Register agent</button>
      </div>
      <div className="summary-strip">
        <span><strong>{agents.length}</strong> Registered</span>
        <span><strong>{agents.filter((a) => a.status === "healthy").length}</strong> Healthy</span>
        <span><strong>{agents.filter((a) => a.status === "quarantined").length}</strong> Quarantined</span>
        <span><strong>{agents.filter((a) => a.status !== "healthy" && a.status !== "quarantined").length}</strong> Need attention</span>
        <span><strong>{new Set(agents.map((a) => a.team)).size}</strong> Teams</span>
      </div>
      <AgentTable
        agents={agents}
        onQuarantine={onQuarantine}
        onLiftQuarantine={onLiftQuarantine}
        auditLogs={audit}
      />
    </main>
  );
}

function ApprovalsView({
  approvals,
  releaseGovernance,
  operatorId,
  onDecision,
  onReleaseDecision,
  onReleaseRetry,
  onViewEvidence,
  canDecide,
  canGovernReleases,
}: {
  approvals: Approval[];
  releaseGovernance: ReleaseGovernanceQueueItem[];
  operatorId: string | null;
  onDecision: (approval: Approval, decision: "approved" | "denied") => Promise<void>;
  onReleaseDecision: (
    governanceId: string,
    decision: "approved" | "rejected",
    reason: string,
  ) => Promise<void>;
  onReleaseRetry: (governanceId: string) => Promise<void>;
  onViewEvidence: (requestId: string) => void;
  canDecide: boolean;
  canGovernReleases: boolean;
}) {
  const [filter, setFilter] = useState<"pending" | "high_risk" | "assigned">("pending");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const filteredApprovals = useMemo(() => {
    if (filter === "high_risk") {
      return approvals.filter((a) => a.risk === "high");
    }
    return approvals;
  }, [approvals, filter]);

  const paginatedApprovals = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredApprovals.slice(startIndex, startIndex + pageSize);
  }, [filteredApprovals, currentPage, pageSize]);

  return (
    <main className="page">
      <div className="page-title-row">
        <div><h2>Approval queue</h2><p>Review consequential actions before they reach production systems.</p></div>
      </div>
      <div className="filter-row">
        <button
          className={`filter-chip ${filter === "pending" ? "filter-active" : ""}`}
          onClick={() => {
            setFilter("pending");
            setCurrentPage(1);
          }}
        >
          Pending <span>{approvals.length}</span>
        </button>
        <button
          className={`filter-chip ${filter === "high_risk" ? "filter-active" : ""}`}
          onClick={() => {
            setFilter("high_risk");
            setCurrentPage(1);
          }}
        >
          High risk <span>{approvals.filter((a) => a.risk === "high").length}</span>
        </button>
        <button
          className={`filter-chip ${filter === "assigned" ? "filter-active" : ""}`}
          onClick={() => {
            setFilter("assigned");
            setCurrentPage(1);
          }}
        >
          Assigned to me
        </button>
      </div>
      {filteredApprovals.length ? (
        <div className="space-y-4">
          <div className="approvals-grid">
            {paginatedApprovals.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} onDecision={onDecision} canDecide={canDecide} />
            ))}
          </div>
          {filteredApprovals.length > 6 && (
            <TablePagination
              currentPage={currentPage}
              totalItems={filteredApprovals.length}
              pageSize={pageSize}
              pageSizeOptions={[6, 12, 24]}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="approvals"
            />
          )}
        </div>
      ) : (
        <section className="panel">
          <EmptyState icon={CheckCircle2} title="Everything is reviewed" description="New high-impact agent actions will appear here." />
        </section>
      )}
      <ReleaseGovernanceQueue
        items={releaseGovernance}
        operatorId={operatorId}
        canGovern={canGovernReleases}
        onDecision={onReleaseDecision}
        onRetry={onReleaseRetry}
        onViewEvidence={onViewEvidence}
      />
    </main>
  );
}

function PoliciesView({
  policies,
  activations,
  audit,
  operatorId,
  onToggle,
  onSaved,
  onActivationDecision,
  onRefresh,
  canManage,
}: {
  policies: Policy[];
  activations: PolicyActivationRequest[];
  audit: AuditEvent[];
  operatorId: string;
  onToggle: (id: string) => void;
  onSaved: (policy: Policy) => void;
  onActivationDecision: (
    requestId: string,
    decision: "approved" | "rejected",
    reason: string,
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
  canManage: boolean;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [historyPolicy, setHistoryPolicy] = useState<Policy | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "active" | "Block" | "Approval" | "pending">("all");
  const [expandedConditions, setExpandedConditions] = useState<Record<string, boolean>>({});

  const policySummary = useMemo(() => summarizePolicyDecisions(audit), [audit]);
  const compliance = policySummary.compliancePercent === null
    ? "—"
    : `${policySummary.compliancePercent.toFixed(1)}%`;

  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      const matchesSearch = `${policy.name} ${policy.description} ${policy.scope}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (modeFilter === "active") return policy.enabled;
      if (modeFilter === "pending") return policy.activationStatus === "pending" || policy.activationStatus === "draft";
      if (modeFilter !== "all" && policy.mode !== modeFilter) return false;
      return true;
    });
  }, [policies, searchQuery, modeFilter]);

  const decisionWidth = (count: number) =>
    policySummary.total ? `${Math.max((count / policySummary.total) * 100, count ? 8 : 0)}%` : "0%";

  function openEditor(policy: Policy | null) {
    setEditingPolicy(policy);
    setEditorOpen(true);
  }

  function toggleConditionExpand(policyId: string) {
    setExpandedConditions((prev) => ({
      ...prev,
      [policyId]: !prev[policyId],
    }));
  }

  function scrollToSandbox() {
    const el = document.getElementById("policy-sandbox");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  const activeCount = policies.filter((p) => p.enabled).length;
  const blockCount = policies.filter((p) => p.mode === "Block").length;
  const approvalCount = policies.filter((p) => p.mode === "Approval").length;
  const pendingCount = policies.filter((p) => p.activationStatus === "pending" || p.activationStatus === "draft").length;

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h2>Policy engine</h2>
          <p>Turn governance requirements into deterministic guardrails executed across every agent action.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="secondary-button"
            onClick={scrollToSandbox}
          >
            <Zap className="h-4 w-4 text-sentinel-accent" /> Test in Sandbox
          </button>
          <button
            className="primary-button primary-large"
            onClick={() => openEditor(null)}
            disabled={!canManage}
          >
            <Plus /> Create policy
          </button>
        </div>
      </div>

      <div className="policy-layout">
        <section className="panel policy-list">
          <div className="section-heading flex-wrap gap-3">
            <div>
              <h2>Enforcement policies</h2>
              <p>{activeCount} of {policies.length} policies actively enforced</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="search-field">
                <Search />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search rules or scopes…"
                  aria-label="Search policies"
                />
              </label>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-sentinel-border/50 text-xs">
            <button
              type="button"
              onClick={() => setModeFilter("all")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                modeFilter === "all"
                  ? "bg-sentinel-surface-raised text-sentinel-text border border-sentinel-border-strong"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              All ({policies.length})
            </button>
            <button
              type="button"
              onClick={() => setModeFilter("active")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                modeFilter === "active"
                  ? "bg-sentinel-success-soft text-sentinel-success border border-sentinel-success/30"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setModeFilter("Block")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                modeFilter === "Block"
                  ? "bg-sentinel-danger-soft text-sentinel-danger border border-sentinel-danger/30"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              Block ({blockCount})
            </button>
            <button
              type="button"
              onClick={() => setModeFilter("Approval")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                modeFilter === "Approval"
                  ? "bg-sentinel-amber-soft text-sentinel-amber border border-sentinel-amber/30"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              Approval ({approvalCount})
            </button>
            {pendingCount > 0 ? (
              <button
                type="button"
                onClick={() => setModeFilter("pending")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  modeFilter === "pending"
                    ? "bg-sentinel-accent-soft text-sentinel-accent border border-sentinel-accent/30"
                    : "text-sentinel-muted hover:text-sentinel-text"
                }`}
              >
                Review ({pendingCount})
              </button>
            ) : null}
          </div>

          <div className="space-y-3 pt-2">
            {filteredPolicies.map((policy) => {
              const isExpanded = Boolean(expandedConditions[policy.id]);
              return (
                <article
                  className="rounded-2xl border border-sentinel-border bg-sentinel-surface p-4 transition hover:border-sentinel-border-strong space-y-3"
                  key={policy.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`policy-icon policy-${policy.mode.toLowerCase()} mt-0.5 shrink-0`}>
                        {policy.mode === "Block" ? <LockKeyhole /> : policy.mode === "Approval" ? <ClipboardCheck /> : <Activity />}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-sentinel-text">{policy.name}</h3>
                          <span className={`mode mode-${policy.mode.toLowerCase()}`}>{policy.mode}</span>
                          {policy.activationStatus === "pending" ? (
                            <span className="mode mode-approval">Awaiting approval</span>
                          ) : policy.activationStatus === "draft" ? (
                            <span className="mode mode-block">Draft v{policy.latestVersionNumber}</span>
                          ) : null}
                        </div>
                        <p className="text-xs text-sentinel-muted leading-relaxed">{policy.description}</p>
                        <div className="flex items-center gap-2 font-mono text-[11px] text-sentinel-muted flex-wrap">
                          <span>{policy.scope}</span>
                          <span>•</span>
                          <span>active v{policy.activeVersionNumber ?? 1}</span>
                          <span>•</span>
                          <span>{policy.matches} matches (7d)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        className="rounded-lg border border-sentinel-border px-2.5 py-1.5 text-xs font-semibold text-sentinel-muted transition hover:border-sentinel-border-strong hover:text-sentinel-text"
                        onClick={() => setHistoryPolicy(policy)}
                        title="View version audit history"
                      >
                        History
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-sentinel-border px-2.5 py-1.5 text-xs font-semibold text-sentinel-muted transition hover:border-sentinel-border-strong hover:text-sentinel-text disabled:opacity-40"
                        onClick={() => openEditor(policy)}
                        disabled={!canManage}
                      >
                        Edit
                      </button>
                      <button
                        role="switch"
                        aria-checked={policy.enabled}
                        aria-label={`${policy.enabled ? "Disable" : "Request activation for"} ${policy.name}`}
                        className={`toggle ${policy.enabled ? "toggle-on" : ""}`}
                        disabled={!canManage || policy.activationStatus === "pending"}
                        onClick={() => onToggle(policy.id)}
                      >
                        <span />
                      </button>
                    </div>
                  </div>

                  {/* Condition preview toggle */}
                  {policy.conditions && policy.conditions.length > 0 && (
                    <div className="border-t border-sentinel-border/40 pt-2.5">
                      <button
                        type="button"
                        onClick={() => toggleConditionExpand(policy.id)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-sentinel-accent hover:underline"
                      >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                        <span>{isExpanded ? "Hide rule logic" : `Inspect rule logic (${policy.conditions.length} condition${policy.conditions.length === 1 ? "" : "s"})`}</span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 rounded-xl border border-sentinel-border bg-sentinel-canvas/60 p-3 space-y-1.5 font-mono text-[11px] animate-dialog-in">
                          <div className="text-[10px] text-sentinel-muted font-bold uppercase tracking-wider">
                            Match Predicates (ALL)
                          </div>
                          {policy.conditions.map((cond, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs flex-wrap">
                              <span className="rounded bg-sentinel-surface-raised px-1.5 py-0.5 text-sentinel-text font-semibold">
                                {cond.field}
                              </span>
                              <span className="text-sentinel-muted">{cond.operator}</span>
                              <span className="rounded bg-sentinel-accent-soft px-1.5 py-0.5 text-sentinel-accent font-semibold">
                                {Array.isArray(cond.value) ? cond.value.join(", ") : String(cond.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {filteredPolicies.length === 0 && (
            <EmptyState
              icon={Search}
              title="No policies found"
              description="Try adjusting your policy search query or mode filter."
            />
          )}
        </section>
        <aside className="space-y-4">
          <PolicyActivationQueue
            requests={activations}
            operatorId={operatorId}
            onDecision={onActivationDecision}
          />
          <section className="panel policy-insight">
            <div className="insight-icon"><ShieldCheck /></div>
            <h2>{compliance}</h2>
            <strong>Policy compliance</strong>
            <p>{policySummary.total ? `Controls recorded ${policySummary.total} policy decisions in the current audit window.` : "No completed policy decisions have been recorded yet."}</p>
            <div className="insight-bars">
              <span><i style={{ width: decisionWidth(policySummary.allowed) }} />Allowed <b>{policySummary.allowed}</b></span>
              <span><i style={{ width: decisionWidth(policySummary.approved) }} />Approved <b>{policySummary.approved}</b></span>
              <span><i style={{ width: decisionWidth(policySummary.blocked) }} />Blocked <b>{policySummary.blocked}</b></span>
            </div>
          </section>
        </aside>
      </div>

      <div id="policy-sandbox" className="mt-5 scroll-mt-6">
        <PolicySimulationPanel policies={policies} />
      </div>
      {editorOpen ? (
        <PolicyEditorDialog
          policy={editingPolicy}
          onClose={() => setEditorOpen(false)}
          onSaved={(savedPolicy) => {
            onSaved(savedPolicy);
            setEditorOpen(false);
          }}
        />
      ) : null}
      {historyPolicy ? (
        <PolicyHistoryDialog
          policy={historyPolicy}
          canManage={canManage}
          onClose={() => setHistoryPolicy(null)}
          onChanged={onRefresh}
        />
      ) : null}
    </main>
  );
}

function AuditView({
  audit,
  onOpenDetails,
  initialEventId,
}: {
  audit: AuditEvent[];
  onOpenDetails: (requestId: string) => void;
  initialEventId?: string;
}) {
  const [query, setQuery] = useState(initialEventId ?? "");
  const [scope, setScope] = useState<"all" | "security">(initialEventId ? "security" : "all");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "7d" | "30d">("all");
  const [decisionFilter, setDecisionFilter] = useState<"all" | "Allowed" | "Approved" | "Blocked">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [verifying, setVerifying] = useState(false);
  const [testingDelivery, setTestingDelivery] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [digestMfaPrompt, setDigestMfaPrompt] = useState(false);
  const [integrityError, setIntegrityError] = useState("");
  const [referenceTime] = useState(() => Date.now());
  const [integrity, setIntegrity] = useState<{
    verified: boolean;
    eventsChecked: number;
    checkpointsCount?: number;
    organizationsChecked: number;
    firstInvalidEventId: string | null;
    checkedAt: string;
  } | null>(null);

  const securityEvents = useMemo(
    () => audit.filter((event) => /^(operator\.|identity\.|api_key\.|github_app\.|slack\.)/.test(event.action)),
    [audit],
  );

  const filtered = useMemo(() => {
    const baseList = scope === "security" ? securityEvents : audit;

    return baseList.filter((event) => {
      const matchesQuery = `${event.id} ${event.agent} ${event.action} ${event.actor} ${event.result}`
        .toLowerCase()
        .includes(query.toLowerCase());
      if (!matchesQuery) return false;

      if (decisionFilter !== "all" && event.result !== decisionFilter) {
        return false;
      }

      if (timeFilter !== "all") {
        const eventTimestamp = parseEventTimestamp(event.time, referenceTime);
        if (!Number.isNaN(eventTimestamp)) {
          const diffMs = referenceTime - eventTimestamp;
          if (timeFilter === "today" && (diffMs > 24 * 60 * 60 * 1000 || diffMs < -60000)) return false;
          if (timeFilter === "7d" && (diffMs > 7 * 24 * 60 * 60 * 1000 || diffMs < -60000)) return false;
          if (timeFilter === "30d" && (diffMs > 30 * 24 * 60 * 60 * 1000 || diffMs < -60000)) return false;
        }
      }

      return true;
    });
  }, [audit, securityEvents, scope, query, decisionFilter, timeFilter, referenceTime]);

  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, currentPage, pageSize]);

  const mfaEvents = securityEvents.filter((event) => event.action.includes("mfa"));
  const sessionEvents = securityEvents.filter((event) => event.action.includes("session"));

  async function verifyIntegrity() {
    setVerifying(true);
    setIntegrityError("");
    try {
      const response = await fetch("/api/v1/audit/integrity", {
        cache: "no-store",
      });
      const payload = (await response.json()) as NonNullable<typeof integrity> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Audit verification failed.");
      }
      setIntegrity(payload);
    } catch (verificationError) {
      setIntegrityError(
        verificationError instanceof Error
          ? verificationError.message
          : "Audit verification failed.",
      );
    } finally {
      setVerifying(false);
    }
  }

  async function testSecurityDigestDelivery() {
    setTestingDelivery(true); setDeliveryMessage("");
    try {
      const response = await fetch("/api/v1/security-digest/test", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; email?: { delivered: boolean; reason: string }; slack?: { delivered: boolean; reason: string } };
      if (!response.ok) throw new Error(payload.error || "Security digest test failed.");
      setDeliveryMessage(`Test sent — email: ${payload.email?.reason ?? "not configured"}; Slack: ${payload.slack?.reason ?? "not configured"}.`);
    } catch (value) {
      const message = value instanceof Error ? value.message : "Security digest test failed.";
      if (message.includes("Recent MFA verification")) { setDigestMfaPrompt(true); return; }
      setDeliveryMessage(message);
    }
    finally { setTestingDelivery(false); }
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <div><h2>{scope === "security" ? "Security activity" : "Audit log"}</h2><p>{scope === "security" ? "Identity, MFA, session, and credential-security evidence across your organization." : "An immutable record of agent actions, policy decisions, and human approvals."}</p></div>
        <div className="flex items-center gap-3">
          <button
            className="primary-button"
            onClick={verifyIntegrity}
            disabled={verifying}
          >
            {verifying ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
            {verifying ? "Verifying…" : "Verify integrity"}
          </button>
          <button className="secondary-button" onClick={() => void testSecurityDigestDelivery()} disabled={testingDelivery}>
            {testingDelivery ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
            {testingDelivery ? "Sending…" : "Test security digest"}
          </button>
          <a
            className="secondary-button"
            href={`/api/v1/audit/export?scope=${scope}`}
            download
          >
            <ArrowDownToLine /> Export CSV
          </a>
        </div>
      </div>
      {integrity ? (
        <section
          className={`mb-5 flex items-start gap-3 rounded-xl border p-4 ${
            integrity.verified
              ? "border-sentinel-lime/30 bg-sentinel-lime/10"
              : "border-red-400/30 bg-red-400/10"
          }`}
        >
          {integrity.verified ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sentinel-lime" />
          ) : (
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
          )}
          <div>
            <strong className="text-sm text-sentinel-text">
              {integrity.verified
                ? "Audit chain integrity verified"
                : "Audit chain verification failed"}
            </strong>
            <p className="mt-1 text-xs text-sentinel-muted">
              Checked {integrity.eventsChecked.toLocaleString()} events across {integrity.organizationsChecked.toLocaleString()} organization{integrity.organizationsChecked === 1 ? "" : "s"} at {new Date(integrity.checkedAt).toLocaleString()}.
              {integrity.checkpointsCount ? ` Anchored by ${integrity.checkpointsCount} historical archival checkpoint${integrity.checkpointsCount === 1 ? "" : "s"}.` : ""}
              {integrity.firstInvalidEventId
                ? ` First invalid event: ${integrity.firstInvalidEventId}.`
                : " Every event hash and previous-hash link is intact."}
            </p>
          </div>
        </section>
      ) : integrityError ? (
        <section className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">
          {integrityError}
        </section>
      ) : null}
      {deliveryMessage ? <section className="mb-5 rounded-xl border border-sentinel-line bg-sentinel-surface px-4 py-3 text-sm text-sentinel-muted">{deliveryMessage}</section> : null}
      {digestMfaPrompt ? <MfaVerificationDialog actionLabel="send this security digest test" onClose={() => setDigestMfaPrompt(false)} onVerified={testSecurityDigestDelivery} /> : null}
      <section className="mb-5 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted">Security events</p><p className="mt-2 text-2xl font-semibold text-sentinel-text">{securityEvents.length}</p><p className="mt-1 text-xs text-sentinel-muted">Last 100 audit records</p></div><div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted">MFA evidence</p><p className="mt-2 text-2xl font-semibold text-sentinel-lime">{mfaEvents.length}</p><p className="mt-1 text-xs text-sentinel-muted">Enrollments and verifications</p></div><div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-4"><p className="text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted">Session events</p><p className="mt-2 text-2xl font-semibold text-sentinel-text">{sessionEvents.length}</p><p className="mt-1 text-xs text-sentinel-muted">Login, expiry, and session control</p></div></section>
      <section className="panel table-panel audit-table">
        <div className="section-heading table-heading">
          <label className="search-field wide-search"><Search /><input value={query} onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); }} placeholder="Search actions, agents, or actors…" /></label>
          <div className="table-controls flex items-center gap-2 flex-wrap">
            <label className="select-field secondary-button flex items-center gap-1.5 cursor-pointer">
              <Clock3 className="h-3.5 w-3.5 text-sentinel-muted shrink-0" />
              <select
                className="bg-transparent text-xs text-sentinel-text outline-none cursor-pointer pr-1 font-medium"
                value={timeFilter}
                onChange={(e) => {
                  setTimeFilter(e.target.value as "all" | "today" | "7d" | "30d");
                  setCurrentPage(1);
                }}
                aria-label="Filter audit events by time range"
              >
                <option value="all">All time</option>
                <option value="today">Today / 24h</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </label>

            <label className="select-field secondary-button flex items-center gap-1.5 cursor-pointer">
              <Filter className="h-3.5 w-3.5 text-sentinel-muted shrink-0" />
              <select
                className="bg-transparent text-xs text-sentinel-text outline-none cursor-pointer pr-1 font-medium"
                value={decisionFilter}
                onChange={(e) => {
                  setDecisionFilter(e.target.value as "all" | "Allowed" | "Approved" | "Blocked");
                  setCurrentPage(1);
                }}
                aria-label="Filter audit events by decision"
              >
                <option value="all">All decisions</option>
                <option value="Allowed">Allowed</option>
                <option value="Approved">Approved</option>
                <option value="Blocked">Blocked</option>
              </select>
            </label>

            <button
              className={`secondary-button ${scope === "security" ? "border-sentinel-lime/40 text-sentinel-lime bg-sentinel-lime/10" : ""}`}
              onClick={() => {
                setScope((current) => (current === "all" ? "security" : "all"));
                setCurrentPage(1);
              }}
              title="Toggle between all events and security-specific events"
            >
              <Filter className="h-3.5 w-3.5" />
              {scope === "security" ? "Security activity" : "All activity"}
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Timestamp</th><th>Agent</th><th>Action</th><th>Decision</th><th>Actor</th><th>Evidence</th></tr></thead>
            <tbody>
              {paginatedEvents.map((event) => (
                <tr key={event.id}>
                  <td className="mono">{displayTime(event.time)}</td>
                  <td><strong className="plain-strong">{event.agent}</strong></td>
                  <td>{event.action}</td>
                  <td><span className={`decision decision-${event.result.toLowerCase()}`}>{event.result}</span></td>
                  <td>{event.actor}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      {event.requestId ? (
                        <button
                          className="text-button"
                          onClick={() => onOpenDetails(event.requestId!)}
                        >
                          View details
                        </button>
                      ) : null}
                      {event.externalReference?.startsWith("https://github.com/") ? (
                        <a
                          className="text-button"
                          href={event.externalReference}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Open external GitHub evidence"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> GitHub
                        </a>
                      ) : event.externalReference?.startsWith("dry-run://") ? (
                        <span
                          className="font-mono text-[10px] text-sentinel-muted"
                          title={event.externalReference}
                        >
                          Dry-run evidence
                        </span>
                      ) : event.requestId ? null : (
                        <span className="text-sentinel-muted">Recorded</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <EmptyState
            icon={Search}
            title="No audit events found"
            description="Try adjusting your search query, time range, or decision filters."
          />
        )}
        <TablePagination
          currentPage={currentPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="events"
        />
      </section>
    </main>
  );
}

function ActionDetailDrawer({
  requestId,
  onClose,
  canRetryExecution,
  onExecutionRetried,
  onNotify,
  operatorId,
  canGovernReleases,
}: {
  requestId: string | null;
  onClose: () => void;
  canRetryExecution: boolean;
  onExecutionRetried: () => Promise<void>;
  onNotify: (message: string) => void;
  operatorId: string | null;
  canGovernReleases: boolean;
}) {
  const [detail, setDetail] = useState<ActionDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(requestId));
  const [retrying, setRetrying] = useState(false);
  const [refreshSequence, setRefreshSequence] = useState(0);
  const [governanceReason, setGovernanceReason] = useState("");
  const [governanceLoading, setGovernanceLoading] = useState("");

  useEffect(() => {
    if (!requestId) return;
    const controller = new AbortController();

    async function loadDetail() {
      try {
        const response = await fetch(
          `/api/v1/actions/${requestId}/details`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as ActionDetail & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load action evidence.");
        }
        setDetail(payload);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load action evidence.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadDetail();
    return () => controller.abort();
  }, [requestId, refreshSequence]);

  async function retryExecution() {
    if (!requestId || !canRetryExecution || retrying) return;
    setRetrying(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/actions/${requestId}/execution/retry`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Execution could not be retried.");
      }
      await onExecutionRetried();
      setDetail((current) => current ? {
        ...current,
        execution: {
          ...current.execution,
          status: "not_started",
          summary: "Retry queued. The execution worker is starting.",
          errorCode: null,
          startedAt: null,
          completedAt: null,
          externalReference: null,
        },
      } : current);
      onNotify("Release execution was safely requeued.");
      window.setTimeout(() => setRefreshSequence((value) => value + 1), 1_000);
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Execution could not be retried.",
      );
    } finally {
      setRetrying(false);
    }
  }

  async function requestDraftGovernance(operation: "publish" | "cancel") {
    if (!requestId || !governanceReason.trim() || governanceLoading) return;
    setGovernanceLoading(`request-${operation}`);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/actions/${requestId}/draft-governance`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ operation, reason: governanceReason.trim() }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Draft governance request could not be created.");
      }
      setGovernanceReason("");
      await onExecutionRetried();
      setRefreshSequence((value) => value + 1);
      onNotify(
        `${operation === "publish" ? "Publication" : "Cancellation"} now requires a second administrator.`,
      );
    } catch (governanceError) {
      setError(
        governanceError instanceof Error
          ? governanceError.message
          : "Draft governance request could not be created.",
      );
    } finally {
      setGovernanceLoading("");
    }
  }

  async function decideDraftGovernance(
    governanceId: string,
    decision: "approved" | "rejected",
  ) {
    if (!governanceReason.trim() || governanceLoading) return;
    setGovernanceLoading(`${decision}-${governanceId}`);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/release-governance/${governanceId}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision, reason: governanceReason.trim() }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Governance decision could not be recorded.");
      }
      setGovernanceReason("");
      await onExecutionRetried();
      setRefreshSequence((value) => value + 1);
      window.setTimeout(() => setRefreshSequence((value) => value + 1), 1_000);
      onNotify(`Draft operation was ${decision}.`);
    } catch (governanceError) {
      setError(
        governanceError instanceof Error
          ? governanceError.message
          : "Governance decision could not be recorded.",
      );
    } finally {
      setGovernanceLoading("");
    }
  }

  useEffect(() => {
    if (!requestId) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, requestId]);

  if (!requestId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm"
      role="presentation"
      onMouseDown={onClose}
    >
      <aside
        className="h-full w-full max-w-2xl overflow-y-auto border-l border-sentinel-line bg-sentinel-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-sentinel-line bg-sentinel-surface/95 px-4 sm:px-7 py-4 sm:py-6 backdrop-blur">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sentinel-lime">
              Tamper-evident record
            </span>
            <h2 id="action-detail-title" className="mt-1 sm:mt-2 text-lg sm:text-xl font-semibold text-sentinel-text">
              Action evidence
            </h2>
            <p className="mt-1 font-mono text-[11px] sm:text-xs text-sentinel-muted break-all">
              {requestId}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close action details">
            <X />
          </button>
        </header>

        <div className="space-y-4 sm:space-y-6 p-4 sm:p-7">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-sentinel-muted">
              <LoaderCircle className="h-5 w-5 animate-spin text-sentinel-lime" />
              Loading evidence…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-200">
              {error}
            </div>
          ) : detail ? (
            <>
              <section className="rounded-xl border border-sentinel-border bg-sentinel-panel-soft p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-sentinel-text">{detail.action}</h3>
                    <p className="mt-1 break-all text-sm text-sentinel-muted">{detail.resource}</p>
                  </div>
                  <Risk risk={detail.risk} />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-xs max-sm:grid-cols-1">
                  <div><dt className="text-sentinel-muted">Agent</dt><dd className="mt-1 font-semibold text-sentinel-text">{detail.agent.name}</dd></div>
                  <div><dt className="text-sentinel-muted">Environment</dt><dd className="mt-1 font-semibold capitalize text-sentinel-text">{detail.environment}</dd></div>
                  <div><dt className="text-sentinel-muted">Owner</dt><dd className="mt-1 font-semibold text-sentinel-text">{detail.agent.owner}</dd></div>
                  <div><dt className="text-sentinel-muted">Requested</dt><dd className="mt-1 font-semibold text-sentinel-text">{new Date(detail.requestedAt).toLocaleString()}</dd></div>
                </dl>
              </section>

              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <section className="rounded-xl border border-sentinel-border bg-sentinel-panel-soft p-5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sentinel-muted">Decision</span>
                  <h3 className="mt-2 text-base font-semibold capitalize text-sentinel-text">{detail.decision.status}</h3>
                  <p className="mt-2 text-xs leading-5 text-sentinel-muted">{detail.decision.reason}</p>
                  <div className="mt-4 border-t border-sentinel-border pt-3 text-xs text-sentinel-muted">
                    {detail.decision.policyName || "Safety default"}
                    {detail.decision.decidedBy ? ` · ${detail.decision.decidedBy}` : ""}
                  </div>
                </section>
                <section className="rounded-xl border border-sentinel-border bg-sentinel-panel-soft p-5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sentinel-muted">Execution</span>
                  <h3 className="mt-2 text-base font-semibold capitalize text-sentinel-text">{detail.execution.status.replace("_", " ")}</h3>
                  <p className="mt-2 text-xs leading-5 text-sentinel-muted">{detail.execution.summary || "No execution outcome reported."}</p>
                  {detail.execution.errorCode ? (
                    <div className="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 p-3">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-red-300">
                        Failure code
                      </span>
                      <code className="mt-1 block break-all text-[11px] text-red-100">
                        {detail.execution.errorCode}
                      </code>
                    </div>
                  ) : null}
                  {detail.execution.externalReference?.startsWith("https://github.com/") ? (
                    <a className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-sentinel-lime" href={detail.execution.externalReference} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Open GitHub evidence
                    </a>
                  ) : detail.execution.externalReference?.startsWith("dry-run://") ? (
                    <code
                      className="mt-4 block break-all text-[10px] text-sentinel-lime"
                      title="No external write was performed"
                    >
                      {detail.execution.externalReference}
                    </code>
                  ) : null}
                  {detail.execution.status === "failed" ? (
                    <button
                      type="button"
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-sentinel-lime px-4 py-2.5 text-xs font-bold text-[#08100b] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={!canRetryExecution || retrying}
                      title={canRetryExecution ? undefined : "Admin role required"}
                      onClick={() => void retryExecution()}
                    >
                      {retrying ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      {retrying ? "Requeuing…" : "Retry execution"}
                    </button>
                  ) : null}
                </section>
              </div>

              {(detail.execution.externalReference?.startsWith("https://github.com/") ||
                detail.draftGovernance.length > 0) ? (
                <section className="rounded-xl border border-sentinel-lime/25 bg-sentinel-lime/5 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sentinel-lime">
                        Independent release control
                      </span>
                      <h3 className="mt-2 text-base font-semibold text-sentinel-text">
                        Publish or cancel GitHub draft
                      </h3>
                      <p className="mt-1 text-xs leading-5 text-sentinel-muted">
                        Draft creation approval cannot publish this release. A different administrator must approve either operation.
                      </p>
                    </div>
                    <ShieldCheck className="h-5 w-5 shrink-0 text-sentinel-lime" />
                  </div>

                  {detail.draftGovernance[0] ? (
                    <div className="mt-4 rounded-xl border border-sentinel-line bg-sentinel-canvas/60 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-xs font-semibold capitalize text-sentinel-text">
                          {detail.draftGovernance[0].operation} draft
                        </strong>
                        <span className={`mode ${detail.draftGovernance[0].status === "failed" || detail.draftGovernance[0].status === "rejected" ? "mode-block" : detail.draftGovernance[0].status === "succeeded" ? "mode-monitor" : "mode-approval"}`}>
                          {detail.draftGovernance[0].status}
                        </span>
                      </div>
                      <p className="mt-2 break-words text-xs leading-5 text-sentinel-muted">
                        {detail.draftGovernance[0].requestReason}
                      </p>
                      <p className="mt-2 break-all text-[10px] text-sentinel-dim">
                        Requested by {detail.draftGovernance[0].requestedBy}
                      </p>
                      {detail.draftGovernance[0].reviewedBy ? (
                        <p className="mt-1 break-all text-[10px] text-sentinel-dim">
                          Reviewed by {detail.draftGovernance[0].reviewedBy}
                        </p>
                      ) : null}
                      {detail.draftGovernance[0].executionSummary ? (
                        <p className="mt-3 text-xs leading-5 text-sentinel-muted">
                          {detail.draftGovernance[0].executionSummary}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {detail.draftGovernance[0]?.status === "pending" ? (
                    detail.draftGovernance[0].requestedByOperatorId === operatorId ? (
                      <div className="mt-4 rounded-lg border border-sentinel-amber/25 bg-sentinel-amber/5 px-3 py-2 text-xs leading-5 text-sentinel-amber">
                        A different administrator must review this request.
                      </div>
                    ) : canGovernReleases ? (
                      <div className="mt-4 space-y-3">
                        <input
                          className="h-10 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-xs text-sentinel-text outline-none placeholder:text-sentinel-dim focus:border-sentinel-lime/60"
                          value={governanceReason}
                          onChange={(event) => setGovernanceReason(event.target.value)}
                          placeholder="Independent review note (required)"
                          aria-label="Independent release review note"
                        />
                        <div className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
                          <button
                            type="button"
                            className="secondary-button justify-center"
                            disabled={!governanceReason.trim() || Boolean(governanceLoading)}
                            onClick={() => void decideDraftGovernance(detail.draftGovernance[0].id, "rejected")}
                          >
                            <XCircle /> Reject
                          </button>
                          <button
                            type="button"
                            className="primary-button justify-center"
                            disabled={!governanceReason.trim() || Boolean(governanceLoading)}
                            onClick={() => void decideDraftGovernance(detail.draftGovernance[0].id, "approved")}
                          >
                            {governanceLoading ? <LoaderCircle className="animate-spin" /> : <Check />}
                            Approve operation
                          </button>
                        </div>
                      </div>
                    ) : null
                  ) : null}

                  {(!detail.draftGovernance[0] ||
                    ["rejected", "expired", "failed"].includes(detail.draftGovernance[0].status)) &&
                    canGovernReleases ? (
                    <div className="mt-4 space-y-3">
                      <input
                        className="h-10 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-xs text-sentinel-text outline-none placeholder:text-sentinel-dim focus:border-sentinel-lime/60"
                        value={governanceReason}
                        onChange={(event) => setGovernanceReason(event.target.value)}
                        placeholder="Reason and change ticket (required)"
                        aria-label="Release governance request reason"
                      />
                      <div className="grid grid-cols-2 gap-2 max-[420px]:grid-cols-1">
                        <button
                          type="button"
                          className="secondary-button justify-center"
                          disabled={!governanceReason.trim() || Boolean(governanceLoading)}
                          onClick={() => void requestDraftGovernance("cancel")}
                        >
                          <XCircle /> Request cancellation
                        </button>
                        <button
                          type="button"
                          className="primary-button justify-center"
                          disabled={!governanceReason.trim() || Boolean(governanceLoading)}
                          onClick={() => void requestDraftGovernance("publish")}
                        >
                          {governanceLoading ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
                          Request publication
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <FileClock className="h-4 w-4 text-sentinel-lime" />
                  <h3 className="text-sm font-semibold text-sentinel-text">Evidence timeline</h3>
                </div>
                <div className="space-y-3 border-l border-sentinel-border pl-5">
                  {detail.timeline.map((event) => (
                    <article className="relative rounded-lg border border-sentinel-border bg-sentinel-panel-soft p-4" key={event.id}>
                      <span className="absolute -left-[25px] top-5 h-2 w-2 rounded-full bg-sentinel-lime shadow-[0_0_10px_rgba(183,243,74,0.5)]" />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-xs font-semibold text-sentinel-text">{event.eventType}</strong>
                        <time className="font-mono text-[10px] text-sentinel-muted">{new Date(event.time).toLocaleString()}</time>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-sentinel-muted">{event.detail}</p>
                      <span className="mt-2 block text-[10px] uppercase tracking-[0.1em] text-sentinel-muted">{event.actorType} · {event.actor}</span>
                    </article>
                  ))}
                </div>
              </section>

              {Object.keys(detail.context).length > 0 ? (
                <section className="rounded-xl border border-sentinel-line bg-sentinel-canvas p-5">
                  <h3 className="text-sm font-semibold text-sentinel-text">Request context</h3>
                  <dl className="mt-4 space-y-2 font-mono text-xs">
                    {Object.entries(detail.context).map(([key, value]) => (
                      <div className="flex items-start justify-between gap-5" key={key}>
                        <dt className="text-sentinel-muted">{key}</dt>
                        <dd className="break-all text-right text-sentinel-text">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function IntegrationLogo({ integration }: { integration: Integration }) {
  if (integration.name === "GitHub") return <GitBranch />;
  if (integration.name === "Slack") return <Zap />;
  if (integration.name === "HTTPS Webhooks") return <Webhook />;
  if (integration.name === "AWS") return <Boxes />;
  if (integration.name === "Microsoft 365") return <FileKey2 />;
  if (integration.name === "Python SDK") return <Bot />;
  return <PlugZap />;
}

function integrationStatusLabel(integration: Integration) {
  if (integration.status === "verified") return "Verified";
  if (integration.status === "configured") return "Configured";
  if (integration.status === "attention") return "Needs attention";
  return integration.connected ? "Connected" : "Not connected";
}

function IntegrationsView({
  items,
  live,
  canRetryDeadLetters,
  onRetryDeadLetters,
  canAcknowledgeDrift,
  onAcknowledgeDrift,
  onResolveDrift,
  onViewEvidence,
  onRefresh,
  onNotify,
}: {
  items: Integration[];
  live: boolean;
  canRetryDeadLetters: boolean;
  onRetryDeadLetters: () => Promise<void>;
  canAcknowledgeDrift: boolean;
  onAcknowledgeDrift: (incidentId: string, note: string) => Promise<void>;
  onResolveDrift: (incidentId: string, note: string) => Promise<void>;
  onViewEvidence: (requestId: string) => void;
  onRefresh: () => Promise<void>;
  onNotify: (message: string) => void;
}) {
  const [demoItems, setDemoItems] = useState(integrations);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const visibleItems = live ? items : demoItems;
  const driftIncidents = visibleItems.find((item) => item.name === "GitHub")
    ?.driftIncidents ?? [];

  const filteredItems = useMemo(() => {
    return visibleItems.filter((item) => {
      const matchesSearch = `${item.name} ${item.description} ${item.category}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (categoryFilter === "connected" && !item.connected) return false;
      if (
        categoryFilter !== "all" &&
        categoryFilter !== "connected" &&
        item.category !== categoryFilter
      ) {
        return false;
      }
      return true;
    });
  }, [visibleItems, searchQuery, categoryFilter]);

  const categories = useMemo(() => {
    const list = Array.from(new Set(visibleItems.map((i) => i.category)));
    return ["all", "connected", ...list];
  }, [visibleItems]);

  const connectedCount = visibleItems.filter((i) => i.connected).length;

  function toggle(id: string) {
    setDemoItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              connected: !item.connected,
              events: item.connected ? "Not connected" : "Connected just now",
            }
          : item,
      ),
    );
  }

  async function retryFailedNotifications() {
    setRetrying(true);
    try {
      await onRetryDeadLetters();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h2>Enterprise integrations</h2>
          <p>Connect the systems where AI agents read data, call APIs, and take consequential actions.</p>
        </div>
        <button className="primary-button" onClick={() => setRequestDialogOpen(true)}>
          <Plus /> Request integration
        </button>
      </div>

      {/* Top Metrics Summary Band */}
      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted">
              Active Connectors
            </p>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sentinel-lime opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sentinel-lime" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-sentinel-lime">
            {connectedCount} <span className="text-sm font-normal text-sentinel-muted">/ {visibleItems.length}</span>
          </p>
          <p className="mt-1 text-xs text-sentinel-muted">Enforcing policy controls</p>
        </div>

        <div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted">
            GitHub Drift Guard
          </p>
          <p className="mt-2 text-2xl font-semibold text-sentinel-text">
            {driftIncidents.length === 0 ? "Protected" : `${driftIncidents.length} Drift Alert`}
          </p>
          <p className="mt-1 text-xs text-sentinel-muted">Release workflow guard</p>
        </div>

        <div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted">
            SIEM / ChatOps Routing
          </p>
          <p className="mt-2 text-2xl font-semibold text-sentinel-text">
            Active
          </p>
          <p className="mt-1 text-xs text-sentinel-muted">Slack + HTTPS Webhook outbox</p>
        </div>

        <div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted">
            Agent SDK & APIs
          </p>
          <p className="mt-2 text-2xl font-semibold text-sentinel-lime">
            Ready
          </p>
          <p className="mt-1 text-xs text-sentinel-muted">Python SDK + HTTP REST</p>
        </div>
      </section>

      {/* Search & Filter Header */}
      <section className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="search-field wide-search max-w-sm flex-1">
          <Search />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search integrations, tools, or categories…"
            aria-label="Search integrations"
          />
        </label>

        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`filter-chip ${categoryFilter === cat ? "filter-active" : ""}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === "all" ? "All" : cat === "connected" ? "Connected" : cat}
              {cat === "all" ? (
                <span>{visibleItems.length}</span>
              ) : cat === "connected" ? (
                <span>{connectedCount}</span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      {/* Integrations Grid */}
      <div className="integrations-grid">
        {filteredItems.map((integration) => (
          <article
            className={`panel integration-card ${
              expandedId === integration.id ? "integration-card-expanded" : ""
            }`}
            key={integration.id}
          >
            <div className="integration-logo">
              <IntegrationLogo integration={integration} />
            </div>
            <div className="integration-copy">
              <div className="flex items-center justify-between gap-2">
                <h3>{integration.name}</h3>
                {integration.connected || integration.status === "attention" ? (
                  <span className="connected">
                    <Check /> {integrationStatusLabel(integration)}
                  </span>
                ) : (
                  <span className="rounded-full border border-sentinel-line bg-sentinel-canvas px-2 py-0.5 text-[10px] font-medium text-sentinel-muted">
                    Available
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium text-sentinel-dim">{integration.category}</span>
              <p>{integration.description}</p>
              {integration.repository || integration.mode ? (
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium text-sentinel-muted">
                  {integration.repository ? (
                    <span className="rounded-md border border-sentinel-border bg-sentinel-panel-soft px-2.5 py-1">
                      {integration.repository}
                    </span>
                  ) : null}
                  {integration.mode ? (
                    <span className="rounded-md border border-sentinel-border bg-sentinel-panel-soft px-2.5 py-1">
                      {integration.mode}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="integration-footer">
              <span>{integration.events}</span>
              {integration.id === "int-python-sdk" ? (
                <button
                  className="secondary-button"
                  onClick={() =>
                    setExpandedId(expandedId === integration.id ? null : integration.id)
                  }
                >
                  {expandedId === integration.id ? "Hide Guide" : "Configure"}
                </button>
              ) : live ? (
                (integration.deadLetters ?? 0) > 0 ? (
                  <button
                    className="primary-button"
                    disabled={!canRetryDeadLetters || retrying}
                    onClick={() => void retryFailedNotifications()}
                    title={canRetryDeadLetters ? undefined : "Admin role required"}
                  >
                    <RotateCcw className={retrying ? "animate-spin" : undefined} />
                    {retrying
                      ? "Requeueing"
                      : `Retry ${integration.deadLetters} failed`}
                  </button>
                ) : (
                  <button
                    className={
                      expandedId === integration.id
                        ? "secondary-button"
                        : integration.connected
                        ? "secondary-button"
                        : "primary-button"
                    }
                    onClick={() =>
                      setExpandedId(expandedId === integration.id ? null : integration.id)
                    }
                  >
                    {expandedId === integration.id
                      ? "Hide settings"
                      : integration.connected
                      ? "Configure"
                      : "Connect"}
                  </button>
                )
              ) : (
                <button
                  className={
                    expandedId === integration.id
                      ? "secondary-button"
                      : integration.connected
                      ? "secondary-button"
                      : "primary-button"
                  }
                  onClick={() => {
                    if (
                      integration.name === "AWS" ||
                      integration.name === "Microsoft 365" ||
                      integration.name === "GitHub" ||
                      integration.name === "Slack" ||
                      integration.name === "HTTPS Webhooks"
                    ) {
                      setExpandedId(expandedId === integration.id ? null : integration.id);
                    } else {
                      toggle(integration.id);
                    }
                  }}
                >
                  {expandedId === integration.id
                    ? "Hide settings"
                    : integration.connected
                    ? "Configure"
                    : "Connect"}
                </button>
              )}
            </div>

            {/* Expandable Configuration Panels */}
            {expandedId === integration.id && integration.name === "GitHub" ? (
              <GitHubAppConnection
                integration={integration}
                canManage={canAcknowledgeDrift}
                onChanged={onRefresh}
                onNotify={onNotify}
              />
            ) : null}
            {expandedId === integration.id && integration.name === "Slack" ? (
              <SlackConnection
                integration={integration}
                canManage={canAcknowledgeDrift}
                onChanged={onRefresh}
                onNotify={onNotify}
              />
            ) : null}
            {expandedId === integration.id &&
            (integration.name === "HTTPS Webhooks" || integration.id === "int-https-webhooks") ? (
              <HttpsWebhookConnection
                integration={integration}
                canManage={canAcknowledgeDrift}
                onChanged={onRefresh}
                onNotify={onNotify}
              />
            ) : null}
            {expandedId === integration.id && integration.id === "int-python-sdk" ? (
              <PythonSDKConnection />
            ) : null}
            {expandedId === integration.id && integration.name === "AWS" ? (
              <AwsConnection onNotify={onNotify} />
            ) : null}
            {expandedId === integration.id && integration.name === "Microsoft 365" ? (
              <MicrosoftConnection onNotify={onNotify} />
            ) : null}
          </article>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="panel p-8 text-center space-y-3">
          <EmptyState
            icon={PlugZap}
            title="No matching integrations found"
            description="Try adjusting your search term or category filter, or request a custom connector."
          />
          <button
            className="secondary-button mx-auto mt-2"
            onClick={() => setRequestDialogOpen(true)}
          >
            <Plus /> Request custom integration
          </button>
        </div>
      )}

      <GitHubDriftIncidents
        incidents={driftIncidents}
        canAcknowledge={canAcknowledgeDrift}
        onAcknowledge={onAcknowledgeDrift}
        onResolve={onResolveDrift}
        onViewEvidence={onViewEvidence}
      />
      <RequestIntegrationDialog
        open={requestDialogOpen}
        onClose={() => setRequestDialogOpen(false)}
        onSubmitted={(integrationName) => {
          onNotify(`Integration request for "${integrationName}" submitted. Solutions engineering has been notified.`);
        }}
      />
    </main>
  );
}

function RegisterDialog({
  open,
  onClose,
  onRegister,
}: {
  open: boolean;
  onClose: () => void;
  onRegister: (agent: Agent) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [team, setTeam] = useState("Platform Engineering");
  const [provider, setProvider] = useState("OpenAI");

  if (!open) return null;
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !owner.trim()) return;
    void onRegister({
      id: `agent-${Date.now()}`,
      name: name.trim(),
      description: "Newly registered AI agent awaiting expanded configuration.",
      owner: owner.trim(),
      team,
      status: "healthy",
      provider,
      permissions: ["No permissions granted"],
      actions: 0,
      cost: 0,
      lastAction: "Agent registered",
      lastSeen: "Just now",
    });
    setName("");
    setOwner("");
  }
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="register-title" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <div className="dialog-title"><BrandMark small /><div><h2 id="register-title">Register AI agent</h2><p>Add ownership and provider details. Permissions start locked.</p></div></div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog"><X /></button>
        </div>
        <form onSubmit={submit}>
          <label>Agent name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Invoice Processing Agent" autoFocus required /></label>
          <div className="form-grid">
            <label>Owner email<input type="email" value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="owner@company.com" required /></label>
            <label>Team<select value={team} onChange={(e) => setTeam(e.target.value)}><option>Platform Engineering</option><option>Finance</option><option>Security</option><option>Legal</option><option>Customer Support</option></select></label>
          </div>
          <label>Model provider<select value={provider} onChange={(e) => setProvider(e.target.value)}><option>OpenAI</option><option>Anthropic</option><option>Google</option><option>Azure AI</option><option>Self-hosted</option></select></label>
          <div className="security-note"><LockKeyhole /><div><strong>Secure by default</strong><span>This agent will have no enterprise permissions until a policy owner grants them.</span></div></div>
          <div className="dialog-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit"><Bot /> Register agent</button></div>
        </form>
      </div>
    </div>
  );
}

function WorkspaceBanner({
  mode,
  error,
  onConnect,
}: {
  mode: WorkspaceMode;
  error: string;
  onConnect: () => void;
}) {
  return (
    <div className="mx-7 mt-4 flex min-h-12 items-center gap-3 rounded-lg border border-sentinel-line bg-sentinel-surface px-4 text-xs max-md:mx-4 max-md:items-start max-md:py-3">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          mode === "live"
            ? "bg-sentinel-lime shadow-[0_0_12px_rgba(183,243,74,0.55)]"
            : mode === "connecting"
              ? "animate-pulse bg-sentinel-amber"
              : "bg-sentinel-muted"
        }`}
      />
      <div className="flex-1">
        <strong className="font-semibold text-sentinel-text">
          {mode === "live"
            ? "Live enforcement workspace"
            : mode === "connecting"
              ? "Connecting to live workspace"
              : "Development preview"}
        </strong>
        <span className="ml-2 text-sentinel-muted max-md:ml-0 max-md:mt-1 max-md:block">
          {error ||
            (mode === "live"
              ? "Requests, approvals, policies, and evidence are loaded from PostgreSQL."
              : "The interface is using local demo data until you connect an operator session.")}
        </span>
      </div>
      {mode !== "live" ? (
        <button
          type="button"
          className="secondary-button shrink-0"
          onClick={onConnect}
        >
          <PlugZap /> Connect live
        </button>
      ) : null}
    </div>
  );
}

function LiveConnectionDialog({
  open,
  loading,
  error,
  onClose,
  onConnect,
  onSso,
}: {
  open: boolean;
  loading: boolean;
  error: string;
  onClose: () => void;
  onConnect: (email: string, password: string) => Promise<void>;
  onSso: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("admin@sentinelops.local");
  const [password, setPassword] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState("");
  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (forgotMode) {
      setForgotBusy(true);
      setForgotError("");
      try {
        const response = await fetch("/api/v1/session/forgot-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || "Failed to send reset link.");
        setForgotSent(true);
      } catch (err) {
        setForgotError(err instanceof Error ? err.message : "Failed to send reset link.");
      } finally {
        setForgotBusy(false);
      }
      return;
    }
    await onConnect(email, password);
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-live-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="dialog-title">
            <BrandMark small />
            <div>
              <h2 id="connect-live-title">{forgotMode ? "Reset your password" : "Sign in to SentinelOps"}</h2>
              <p>
                {forgotMode
                  ? "Enter your operator email to receive a secure recovery link."
                  : "Use your organization operator account. The browser receives an opaque, revocable HttpOnly session."}
              </p>
            </div>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="operator@company.com"
              autoComplete="username"
              autoFocus
              required
            />
          </label>
          {!forgotMode ? (
            <label>
              <div className="flex items-center justify-between">
                <span>Password</span>
                <button
                  type="button"
                  className="text-xs font-medium text-sentinel-lime hover:underline"
                  onClick={() => {
                    setForgotMode(true);
                    setForgotSent(false);
                    setForgotError("");
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 12 characters"
                autoComplete="current-password"
                minLength={12}
                required
              />
            </label>
          ) : null}
          {forgotSent ? (
            <div className="security-note">
              <ShieldCheck />
              <div>
                <strong>Recovery link sent</strong>
                <span>If an active operator account exists for {email}, a recovery link has been delivered.</span>
              </div>
            </div>
          ) : null}
          {forgotError || error ? (
            <div className="security-note !border-sentinel-red/40 !bg-sentinel-red/10">
              <ShieldAlert />
              <div>
                <strong>{forgotMode ? "Request failed" : "Connection failed"}</strong>
                <span>{forgotError || error}</span>
              </div>
            </div>
          ) : !forgotMode ? (
            <div className="security-note">
              <ShieldCheck />
              <div>
                <strong>Server-verified session</strong>
                <span>
                  Live data is protected by a revocable, role-scoped account.
                </span>
              </div>
            </div>
          ) : null}
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (forgotMode) {
                  setForgotMode(false);
                  setForgotSent(false);
                  setForgotError("");
                } else {
                  onClose();
                }
              }}
            >
              {forgotMode ? "Back to sign in" : "Cancel"}
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={loading || forgotBusy}
            >
              <PlugZap /> {forgotMode ? (forgotBusy ? "Sending link…" : "Send reset link") : loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
          {!forgotMode ? (
            <button
              type="button"
              className="mt-3 w-full text-center text-sm font-semibold text-sentinel-lime transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void onSso(email)}
              disabled={loading || !email}
            >
              Sign in with your organization SSO
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}

export function ControlCenter({
  initialView = "overview",
  initialAuditEventId,
}: {
  initialView?: DashboardView;
  initialAuditEventId?: string;
}) {
  const [view, setView] = useState<DashboardView>(initialView);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [workspaceMode, setWorkspaceMode] =
    useState<WorkspaceMode>("connecting");
  const [workspaceError, setWorkspaceError] = useState("");
  const [operatorIdentity, setOperatorIdentity] =
    useState<OperatorIdentity | null>(null);
  const [agentList, setAgentList] = useState(initialAgents);
  const [approvalList, setApprovalList] = useState(initialApprovals);
  const [policyList, setPolicyList] = useState(initialPolicies);
  const [policyActivationList, setPolicyActivationList] = useState<PolicyActivationRequest[]>([]);
  const [releaseGovernanceList, setReleaseGovernanceList] = useState<ReleaseGovernanceQueueItem[]>([]);
  const [auditList, setAuditList] = useState(initialAuditEvents);
  const [integrationList, setIntegrationList] = useState(integrations);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | string | null>(null);
  const [pendingMfaAction, setPendingMfaAction] = useState<null | { label: string; retry: () => Promise<void> }>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pendingKeySeqRef = useRef<string | null>(null);
  const keySeqTimerRef = useRef<number | null>(null);

  const handleSelectView = useCallback((nextView: DashboardView) => {
    setView(nextView);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", nextView);
      window.history.pushState({ view: nextView }, "", url.toString());
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) {
        pendingKeySeqRef.current = "g";
        if (keySeqTimerRef.current) window.clearTimeout(keySeqTimerRef.current);
        keySeqTimerRef.current = window.setTimeout(() => {
          pendingKeySeqRef.current = null;
        }, 1200);
        return;
      }

      if (pendingKeySeqRef.current === "g") {
        const key = e.key.toLowerCase();
        pendingKeySeqRef.current = null;
        if (key === "o") { e.preventDefault(); handleSelectView("overview"); }
        else if (key === "a") { e.preventDefault(); handleSelectView("agents"); }
        else if (key === "p") { e.preventDefault(); handleSelectView("policies"); }
        else if (key === "i") { e.preventDefault(); handleSelectView("integrations"); }
        else if (key === "u") { e.preventDefault(); handleSelectView("audit"); }
        else if (key === "c") { e.preventDefault(); handleSelectView("credentials"); }
        else if (key === "t") { e.preventDefault(); handleSelectView("team"); }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSelectView]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("view");
      const validViews = [
        "overview",
        "agents",
        "approvals",
        "policies",
        "audit",
        "integrations",
        "credentials",
        "team",
      ];
      if (requested && validViews.includes(requested)) {
        setView(requested as DashboardView);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("resetToken");
      if (token) setResetToken(token);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const applyLivePayload = useCallback(
    (payload: LiveControlCenterPayload) => {
      setAgentList(payload.agents);
      setApprovalList(payload.approvals);
      setPolicyList(payload.policies);
      setPolicyActivationList(payload.policyActivations);
      setReleaseGovernanceList(payload.releaseGovernance);
      setAuditList(payload.audit);
      setIntegrationList(payload.integrations);
      setOperatorIdentity(payload.operator);
      setWorkspaceMode("live");
      setWorkspaceError("");
    },
    [],
  );

  const refreshLiveWorkspace = useCallback(async () => {
    const response = await fetch("/api/v1/control-center", {
      cache: "no-store",
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(payload.error || "Unable to load live workspace.");
    }
    applyLivePayload(
      (await response.json()) as LiveControlCenterPayload,
    );
  }, [applyLivePayload]);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("sentinelops-demo-state");
        if (saved) {
          const parsed = JSON.parse(saved) as {
            agents?: Agent[];
            approvals?: Approval[];
            policies?: Policy[];
            audit?: AuditEvent[];
          };
          if (parsed.agents) setAgentList(parsed.agents);
          if (parsed.approvals) setApprovalList(parsed.approvals);
          if (parsed.policies) setPolicyList(parsed.policies);
          if (parsed.audit) setAuditList(parsed.audit);
        }
      } catch {
        // Invalid demo state should never prevent the control center from loading.
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreLiveSession() {
      try {
        const response = await fetch("/api/v1/session", {
          cache: "no-store",
        });
        const session = (await response.json()) as {
          authenticated: boolean;
          databaseConfigured: boolean;
          operatorAccountsConfigured: boolean;
          operator: OperatorIdentity | null;
        };
        if (cancelled) return;

        if (
          session.authenticated &&
          session.databaseConfigured &&
          session.operator?.mustChangePassword
        ) {
          setOperatorIdentity(session.operator);
          setWorkspaceMode("demo");
          setPasswordChangeRequired(true);
          setPasswordChangeOpen(true);
          return;
        }

        if (session.authenticated && session.databaseConfigured) {
          await refreshLiveWorkspace();
          return;
        }

        setWorkspaceMode("demo");
        if (!session.databaseConfigured) {
          setWorkspaceError(
            "DATABASE_URL is not configured; demo data remains active.",
          );
        } else if (!session.operatorAccountsConfigured) {
          setWorkspaceError(
            "No operator account exists. Run pnpm operator:create.",
          );
        }
      } catch (error) {
        if (cancelled) return;
        setWorkspaceMode("demo");
        setWorkspaceError(
          error instanceof Error
            ? error.message
            : "Live workspace is unavailable.",
        );
      }
    }

    void restoreLiveSession();
    return () => {
      cancelled = true;
    };
  }, [refreshLiveWorkspace]);

  const releaseWorkerActive = releaseGovernanceList.some(
    (item) => item.status === "approved" || item.status === "executing",
  );
  useEffect(() => {
    if (workspaceMode !== "live" || !releaseWorkerActive) return;
    const timer = window.setInterval(() => {
      void refreshLiveWorkspace().catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [refreshLiveWorkspace, releaseWorkerActive, workspaceMode]);

  useEffect(() => {
    if (!hydrated || workspaceMode !== "demo") return;
    window.localStorage.setItem(
      "sentinelops-demo-state",
      JSON.stringify({
        agents: agentList,
        approvals: approvalList,
        policies: policyList,
        audit: auditList,
      }),
    );
  }, [
    agentList,
    approvalList,
    policyList,
    auditList,
    hydrated,
    workspaceMode,
  ]);

  const pendingApprovals = useMemo(
    () => approvalList.filter((approval) => approval.status === "pending"),
    [approvalList],
  );
  const canApprove =
    workspaceMode !== "live" ||
    operatorIdentity?.role === "admin" ||
    operatorIdentity?.role === "approver";
  const canManagePolicies =
    workspaceMode !== "live" || operatorIdentity?.role === "admin";
  const canManageOperators =
    workspaceMode === "live" && operatorIdentity?.role === "admin";
  const canGovernReleases =
    workspaceMode === "live" && operatorIdentity?.role === "admin";

  async function connectLiveWorkspace(email: string, password: string) {
    setConnectLoading(true);
    setWorkspaceError("");
    try {
      const response = await fetch("/api/v1/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        operator?: OperatorIdentity;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Operator authentication failed.");
      }
      if (payload.operator?.mustChangePassword) {
        setOperatorIdentity(payload.operator);
        setWorkspaceMode("demo");
        setConnectOpen(false);
        setPasswordChangeRequired(true);
        setPasswordChangeError("");
        setPasswordChangeOpen(true);
        return;
      }
      await refreshLiveWorkspace();
      setConnectOpen(false);
      setToast("Signed in to the live enforcement workspace.");
    } catch (error) {
      setWorkspaceMode("demo");
      setWorkspaceError(
        error instanceof Error ? error.message : "Connection failed.",
      );
    } finally {
      setConnectLoading(false);
    }
  }

  async function connectLiveWorkspaceWithSso(email: string) {
    setConnectLoading(true);
    setWorkspaceError("");
    try {
      const response = await fetch("/api/v1/sso/saml/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        authorizeUrl?: string;
      };
      if (!response.ok || !payload.authorizeUrl) {
        throw new Error(payload.error || "Organization SSO is not available.");
      }
      window.location.assign(payload.authorizeUrl);
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : "Unable to start organization SSO.",
      );
      setConnectLoading(false);
    }
  }

  async function changePassword(
    currentPassword: string,
    newPassword: string,
  ) {
    setPasswordChangeLoading(true);
    setPasswordChangeError("");
    try {
      const response = await fetch("/api/v1/session/password", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        operator?: OperatorIdentity;
      };
      if (!response.ok || !payload.operator) {
        throw new Error(payload.error || "Password change failed.");
      }

      setOperatorIdentity(payload.operator);
      setPasswordChangeOpen(false);
      setPasswordChangeRequired(false);
      await refreshLiveWorkspace();
      setToast("Password changed and other sessions were signed out.");
    } catch (error) {
      setPasswordChangeError(
        error instanceof Error ? error.message : "Password change failed.",
      );
    } finally {
      setPasswordChangeLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/v1/session", { method: "DELETE" });
    } finally {
      window.location.assign("/");
    }
  }

  async function retryDeadNotifications() {
    try {
      const response = await fetch("/api/v1/notifications/retry-dead", {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        requeued?: number;
        remainingDead?: number;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to retry failed alerts.");
      }
      await refreshLiveWorkspace();
      const requeued = payload.requeued ?? 0;
      setToast(
        requeued === 1
          ? "One failed alert was returned to the delivery queue."
          : `${requeued} failed alerts were returned to the delivery queue.`,
      );
    } catch (error) {
      setToast(
        error instanceof Error
          ? error.message
          : "Unable to retry failed alerts.",
      );
    }
  }

  async function handleQuarantineAgent(agent: Agent, reason: string) {
    try {
      const response = await fetch(`/api/v1/agents/${agent.id}/quarantine`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to quarantine agent.");
      setAgentList((cur) =>
        cur.map((a) =>
          a.id === agent.id
            ? { ...a, status: "quarantined", quarantineReason: reason, quarantinedAt: new Date().toISOString() }
            : a,
        ),
      );
      setApprovalList((cur) => cur.filter((app) => app.agentId !== agent.id));
      await refreshLiveWorkspace();
      setToast({
        message: `Agent ${agent.name} quarantined under emergency killswitch.`,
        type: "warning",
        actionLabel: "Undo",
        onAction: () => void handleUnquarantineAgent(agent, "Quarantine cancelled by operator"),
        durationMs: 8000,
      });
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Quarantine failed.");
    }
  }

  async function handleUnquarantineAgent(agent: Agent, reason: string) {
    try {
      const response = await fetch(`/api/v1/agents/${agent.id}/unquarantine`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to lift quarantine.");
      setAgentList((cur) =>
        cur.map((a) =>
          a.id === agent.id
            ? { ...a, status: "healthy", quarantineReason: null, quarantinedAt: null }
            : a,
        ),
      );
      setToast(`Quarantine lifted for agent ${agent.name}.`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to lift quarantine.");
    }
  }

  async function acknowledgeGitHubDrift(incidentId: string, note: string) {
    try {
      const response = await fetch(
        `/api/v1/github-drift/${incidentId}/acknowledge`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ note }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Incident could not be acknowledged.");
      await refreshLiveWorkspace();
      setToast("GitHub governance incident acknowledged and preserved in the audit chain.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Incident could not be acknowledged.";
      setToast(message);
      throw error;
    }
  }

  async function resolveGitHubDrift(incidentId: string, note: string) {
    try {
      const response = await fetch(
        `/api/v1/github-drift/${incidentId}/resolve`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ note }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        containmentLifted?: boolean;
        resumedOperations?: number;
      };
      if (!response.ok) throw new Error(payload.error || "Incident could not be resolved.");
      await refreshLiveWorkspace();
      setToast(payload.containmentLifted
        ? payload.resumedOperations
          ? `Containment lifted. ${payload.resumedOperations} approved operation${payload.resumedOperations === 1 ? "" : "s"} resumed.`
          : "Containment lifted and resolution preserved in the audit chain."
        : "GitHub governance incident resolved and preserved in the audit chain.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Incident could not be resolved.";
      setToast(message);
      throw error;
    }
  }

  async function decide(
    approval: Approval,
    decision: "approved" | "denied",
  ) {
    if (workspaceMode === "live") {
      try {
        const response = await fetch(
          `/api/v1/actions/${approval.id}/decision`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              decision,
              reason: `${approval.risk} risk request reviewed in SentinelOps.`,
            }),
          },
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error || "Decision could not be recorded.");
        }
        await refreshLiveWorkspace();
        setToast(`${approval.request} was ${decision}.`);
      } catch (error) {
        setToast(
          error instanceof Error
            ? error.message
            : "Decision could not be recorded.",
        );
      }
      return;
    }

    setApprovalList((current) =>
      current.map((item) =>
        item.id === approval.id ? { ...item, status: decision } : item,
      ),
    );
    setAgentList((current) =>
      current.map((agent) =>
        agent.id === approval.agentId
          ? { ...agent, status: decision === "approved" ? "healthy" : "blocked" }
          : agent,
      ),
    );
    const event: AuditEvent = {
      id: `evt-${Date.now()}`,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      agent: approval.agentName,
      action: approval.request,
      result: decision === "approved" ? "Approved" : "Blocked",
      actor: "Maya Patel",
      detail: `${approval.risk} risk request ${decision}`,
    };
    setAuditList((current) => [event, ...current]);
    setToast({
      message: `${approval.request} was ${decision}.`,
      type: decision === "approved" ? "success" : "warning",
      actionLabel: "View in Audit",
      onAction: () => handleSelectView("audit"),
      durationMs: 6000,
    });
  }

  async function decideReleaseGovernance(
    governanceId: string,
    decision: "approved" | "rejected",
    reason: string,
  ) {
    try {
      const response = await fetch(
        `/api/v1/release-governance/${governanceId}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision, reason }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Release decision could not be recorded.");
      await refreshLiveWorkspace();
      setToast(`Release operation was ${decision}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Release decision could not be recorded.";
      if (message.includes("Recent MFA verification")) {
        setPendingMfaAction({ label: "record this release decision", retry: () => decideReleaseGovernance(governanceId, decision, reason) });
        return;
      }
      setToast(message);
      throw error;
    }
  }

  async function retryReleaseGovernance(governanceId: string) {
    try {
      const response = await fetch(
        `/api/v1/release-governance/${governanceId}/retry`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Release operation could not be retried.");
      await refreshLiveWorkspace();
      setToast("The independently approved release operation was returned to the worker.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Release operation could not be retried.";
      setToast(message);
      throw error;
    }
  }

  async function register(agent: Agent) {
    if (workspaceMode === "live") {
      const response = await fetch("/api/v1/agents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: agent.name, ownerEmail: agent.owner, team: agent.team, provider: agent.provider, environment: "development" }) });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) { setToast(payload.error || "Unable to register agent."); return; }
      await refreshLiveWorkspace();
      setRegisterOpen(false);
      setToast(`${agent.name} is registered and ready for its first governed evaluation.`);
      return;
    }
    setAgentList((current) => [agent, ...current]);
    setAuditList((current) => [
      {
        id: `evt-${Date.now()}`,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        agent: agent.name,
        action: "Agent registered",
        result: "Changed",
        actor: "Maya Patel",
        detail: `Registered with ${agent.provider}`,
      },
      ...current,
    ]);
    setRegisterOpen(false);
    setToast(`${agent.name} is registered with permissions locked.`);
  }

  async function togglePolicy(id: string) {
    const policy = policyList.find((item) => item.id === id);
    if (workspaceMode === "live" && policy) {
      try {
        const response = await fetch(`/api/v1/policies/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            enabled: !policy.enabled,
          }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(payload.error || "Policy update failed.");
        }
        const updated = (await response.json()) as Policy;
        await refreshLiveWorkspace();
        setToast(
          policy.enabled
            ? `${policy.name} was disabled.`
            : updated.activationStatus === "pending"
              ? `${policy.name} activation was submitted for independent review.`
              : `${policy.name} was updated.`,
        );
      } catch (error) {
        setToast(
          error instanceof Error ? error.message : "Policy update failed.",
        );
      }
      return;
    }

    setPolicyList((current) =>
      current.map((item) =>
        item.id === id ? { ...item, enabled: !item.enabled } : item,
      ),
    );
    if (policy) {
      setToast({
        message: `${policy.name} ${policy.enabled ? "disabled" : "enabled"}.`,
        type: "info",
        actionLabel: "Undo",
        onAction: () => void togglePolicy(policy.id),
        durationMs: 7000,
      });
    }
  }

  function savePolicy(policy: Policy) {
    setPolicyList((current) => {
      const exists = current.some((item) => item.id === policy.id);
      const next = exists
        ? current.map((item) => (item.id === policy.id ? policy : item))
        : [...current, policy];
      return next.toSorted(
        (left, right) => (left.priority ?? 100) - (right.priority ?? 100),
      );
    });
    if (workspaceMode === "live") void refreshLiveWorkspace();
    setToast(
      policy.activationStatus === "pending"
        ? `${policy.name} was saved and submitted for independent approval.`
        : `${policy.name} was saved as version ${policy.latestVersionNumber ?? 1}.`,
    );
  }

  async function decidePolicyActivation(
    requestId: string,
    decision: "approved" | "rejected",
    reason: string,
  ) {
    try {
      const response = await fetch(
        `/api/v1/policies/activation-requests/${requestId}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision, reason }),
        },
      );
      const payload = (await response.json()) as {
        policyName?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Policy review could not be recorded.");
      }
      await refreshLiveWorkspace();
      setToast(`${payload.policyName ?? "Policy"} activation was ${decision}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Policy review could not be recorded.";
      if (message.includes("Recent MFA verification")) {
        setPendingMfaAction({ label: "record this policy activation decision", retry: () => decidePolicyActivation(requestId, decision, reason) });
        return;
      }
      setToast(message);
      throw error;
    }
  }

  function openRegisterDialog() {
    if (workspaceMode === "live") {
      setToast(
        "Live agents register automatically when they call the evaluation API.",
      );
      return;
    }
    setRegisterOpen(true);
  }

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        pendingCount={pendingApprovals.length + releaseGovernanceList.filter((item) => item.status === "pending").length}
        canManageOperators={canManageOperators}
        onSelect={handleSelectView}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />
      <div className={`app-content ${sidebarCollapsed ? "app-content-collapsed" : ""}`}>
        <TopBar
          view={view}
          operator={operatorIdentity}
          onMenu={() => setSidebarOpen(true)}
          onChangePassword={() => {
            if (!operatorIdentity) return;
            setPasswordChangeRequired(operatorIdentity.mustChangePassword);
            setPasswordChangeError("");
            setPasswordChangeOpen(true);
          }}
          onLogout={() => void logout()}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onToggleNotifications={() => setNotificationsOpen((prev) => !prev)}
          notificationsOpen={notificationsOpen}
          approvals={approvalList}
          quarantinedAgents={agentList.filter((a) => a.status === "quarantined")}
          onDecision={decide}
          integrityVerified={true}
          onSelectView={handleSelectView}
          canDecide={canApprove}
        />
        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onSelectView={handleSelectView}
          onOpenCreatePolicy={() => handleSelectView("policies")}
          agents={agentList}
          policies={policyList}
        />
        <WorkspaceBanner
          mode={workspaceMode}
          error={workspaceError}
          onConnect={() => {
            setWorkspaceError("");
            setConnectOpen(true);
          }}
        />
        {view === "overview" && (
          <Overview
            agents={agentList}
            approvals={pendingApprovals}
            audit={auditList}
            operator={operatorIdentity}
            live={workspaceMode === "live"}
            onRegister={openRegisterDialog}
            onDecision={decide}
            onViewApprovals={() => handleSelectView("approvals")}
            onOpenCredentials={() => handleSelectView("credentials")}
            onOpenIntegrations={() => handleSelectView("integrations")}
            onOpenPolicies={() => handleSelectView("policies")}
            canDecide={canApprove}
          />
        )}
        {view === "agents" && (
          <AgentsView
            agents={agentList}
            audit={auditList}
            onRegister={openRegisterDialog}
            onQuarantine={canManagePolicies || canApprove ? handleQuarantineAgent : undefined}
            onLiftQuarantine={canManagePolicies || canApprove ? handleUnquarantineAgent : undefined}
          />
        )}
        {view === "approvals" && (
          <ApprovalsView
            approvals={pendingApprovals}
            releaseGovernance={releaseGovernanceList}
            operatorId={operatorIdentity?.id ?? null}
            onDecision={decide}
            onReleaseDecision={decideReleaseGovernance}
            onReleaseRetry={retryReleaseGovernance}
            onViewEvidence={setSelectedRequestId}
            canDecide={canApprove}
            canGovernReleases={canGovernReleases}
          />
        )}
        {view === "policies" && (
          <PoliciesView
            policies={policyList}
            activations={policyActivationList}
            audit={auditList}
            operatorId={operatorIdentity?.id ?? "demo-operator"}
            onToggle={togglePolicy}
            onSaved={savePolicy}
            onActivationDecision={decidePolicyActivation}
            onRefresh={refreshLiveWorkspace}
            canManage={canManagePolicies}
          />
        )}
        {view === "audit" && (
          <AuditView
            audit={auditList}
            onOpenDetails={setSelectedRequestId}
            initialEventId={initialAuditEventId}
          />
        )}
        {view === "integrations" && (
          <IntegrationsView
            items={integrationList}
            live={workspaceMode === "live"}
            canRetryDeadLetters={canManagePolicies}
            onRetryDeadLetters={retryDeadNotifications}
            canAcknowledgeDrift={canGovernReleases}
            onAcknowledgeDrift={acknowledgeGitHubDrift}
            onResolveDrift={resolveGitHubDrift}
            onViewEvidence={setSelectedRequestId}
            onRefresh={refreshLiveWorkspace}
            onNotify={setToast}
          />
        )}
        {view === "credentials" && operatorIdentity?.role === "admin" && (
          <ApiKeyManagement
            organizationName={operatorIdentity.organizationName}
            onNotify={setToast}
          />
        )}
        {view === "team" && operatorIdentity?.role === "admin" && (
          <OperatorManagement
            currentOperator={operatorIdentity}
            onNotify={setToast}
          />
        )}
      </div>
      <RegisterDialog open={registerOpen} onClose={() => setRegisterOpen(false)} onRegister={register} />
      <LiveConnectionDialog
        open={connectOpen}
        loading={connectLoading}
        error={workspaceError}
        onClose={() => setConnectOpen(false)}
        onConnect={connectLiveWorkspace}
        onSso={connectLiveWorkspaceWithSso}
      />
      {passwordChangeOpen ? (
        <PasswordChangeDialog
          key={passwordChangeRequired ? "required" : "voluntary"}
          required={passwordChangeRequired}
          loading={passwordChangeLoading}
          serverError={passwordChangeError}
          onClose={() => {
            if (!passwordChangeRequired) setPasswordChangeOpen(false);
          }}
          onSubmit={changePassword}
        />
      ) : null}
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <ActionDetailDrawer
        key={selectedRequestId ?? "closed"}
        requestId={selectedRequestId}
        onClose={() => setSelectedRequestId(null)}
        canRetryExecution={workspaceMode === "live" && operatorIdentity?.role === "admin"}
        onExecutionRetried={refreshLiveWorkspace}
        onNotify={setToast}
        operatorId={operatorIdentity?.id ?? null}
        canGovernReleases={workspaceMode === "live" && operatorIdentity?.role === "admin"}
      />
      {toast && <ToastNotification toast={toast} onClose={() => setToast(null)} />}
      {pendingMfaAction ? <MfaVerificationDialog actionLabel={pendingMfaAction.label} onClose={() => setPendingMfaAction(null)} onVerified={pendingMfaAction.retry} /> : null}
      {resetToken ? (
        <ResetPasswordFromTokenDialog
          token={resetToken}
          onClose={() => setResetToken(null)}
          onSuccess={() => {
            setResetToken(null);
            setToast("Password updated successfully. You can now sign in.");
            setConnectOpen(true);
          }}
        />
      ) : null}
    </div>
  );
}

function ResetPasswordFromTokenDialog({
  token,
  onClose,
  onSuccess,
}: {
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/session/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const payload = (await response.json()) as { success?: boolean; error?: string };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Password reset failed.");
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="reset-token-title">
        <div className="dialog-header">
          <div className="dialog-title">
            <BrandMark small />
            <div>
              <h2 id="reset-token-title">Set new password</h2>
              <p>Enter your new password to regain access to SentinelOps.</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            New password
            <input
              type="password"
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 12 characters"
              autoFocus
              required
            />
          </label>
          <label>
            Confirm new password
            <input
              type="password"
              minLength={12}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              required
            />
          </label>
          {error ? (
            <div className="security-note !border-sentinel-red/40 !bg-sentinel-red/10">
              <ShieldAlert />
              <div>
                <strong>Error</strong>
                <span>{error}</span>
              </div>
            </div>
          ) : null}
          <div className="dialog-actions">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={loading}>
              <KeyRound /> {loading ? "Updating password…" : "Update password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
