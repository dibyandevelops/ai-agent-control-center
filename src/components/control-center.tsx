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
  SlidersHorizontal,
  UsersRound,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  agents as initialAgents,
  approvals as initialApprovals,
  auditEvents as initialAuditEvents,
  chartData,
  integrations,
  policies as initialPolicies,
} from "@/lib/demo-data";
import {
  buildSevenDayActivity,
  summarizePolicyDecisions,
  type ActivityPoint,
} from "@/lib/dashboard-metrics";
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

type View =
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
  audit: AuditEvent[];
  integrations: Integration[];
}

const navItems: Array<{
  id: View;
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

const titles: Record<View, string> = {
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

function displayTime(value: string) {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(parsed));
}

function Status({ status }: { status: AgentStatus }) {
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
}: {
  view: View;
  onMenu: () => void;
  operator: OperatorIdentity | null;
  onChangePassword: () => void;
}) {
  const initials = operator?.displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "SO";
  return (
    <header className="topbar">
      <button className="icon-button menu-button" onClick={onMenu} aria-label="Open navigation">
        <Menu />
      </button>
      <h1>{titles[view]}</h1>
      <div className="topbar-actions">
        <button className="organization-control">
          <Building2 />
          <span>{operator?.organizationName || "Aperture Labs"}</span>
          <ChevronDown />
        </button>
        <button className="command-control" aria-label="Search or run command">
          <Search />
          <span>Search or run command…</span>
          <kbd>
            <Command />K
          </kbd>
        </button>
        <button className="icon-button notification-button" aria-label="Notifications">
          <Bell />
          <span />
        </button>
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
      </div>
    </header>
  );
}

function Sidebar({
  view,
  open,
  pendingCount,
  canManageOperators,
  onSelect,
  onClose,
}: {
  view: View;
  open: boolean;
  pendingCount: number;
  canManageOperators: boolean;
  onSelect: (view: View) => void;
  onClose: () => void;
}) {
  return (
    <>
      {open && <button className="mobile-overlay" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand">
          <BrandMark />
          <span>
            Sentinel<strong>Ops</strong>
          </span>
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
                aria-current={selected ? "page" : undefined}
              >
                <Icon />
                <span>{item.label}</span>
                {item.id === "approvals" && pendingCount > 0 && (
                  <span className="nav-count">{pendingCount}</span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="system-state">
            <span className="online-dot" />
            <div>
              <span>System status</span>
              <strong>All systems operational</strong>
            </div>
          </div>
          <button className="collapse-control">
            <ChevronLeft />
            Collapse
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

function ActivityChart({ data }: { data: ActivityPoint[] }) {
  const width = 760;
  const height = 210;
  const padding = { left: 38, right: 12, top: 10, bottom: 24 };
  const max = chartMaximum(data);
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];
  const x = (index: number) =>
    padding.left +
    (index * (width - padding.left - padding.right)) / (data.length - 1);
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
          <p>Policy decisions across the last 7 days</p>
        </div>
        <button className="secondary-button">
          <Clock3 /> Last 7 days <ChevronDown />
        </button>
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
}: {
  agents: Agent[];
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | AgentStatus>("all");
  const filtered = agents.filter((agent) => {
    const matchesQuery =
      agent.name.toLowerCase().includes(query.toLowerCase()) ||
      agent.owner.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "all" || agent.status === status);
  });

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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search agents…"
              aria-label="Search agents"
            />
          </label>
          <label className="select-field">
            <Filter />
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | AgentStatus)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="healthy">Healthy</option>
              <option value="review">Review</option>
              <option value="blocked">Blocked</option>
            </select>
          </label>
          <button className="icon-button bordered" aria-label="Export agents">
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
            {filtered.map((agent) => (
              <tr key={agent.id}>
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
                <td><button className="icon-button row-action" aria-label={`More actions for ${agent.name}`}><MoreHorizontal /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <EmptyState icon={Search} title="No agents found" description="Try a different name or status filter." />
      )}
      <div className="table-footer">
        <span>Showing {filtered.length} of {agents.length} agents</span>
        <div className="pagination">
          <button disabled><ChevronLeft /></button>
          <button className="page-active">1</button>
          <button>2</button>
          <button>3</button>
          <button><ChevronRight /></button>
        </div>
      </div>
    </section>
  );
}

function ApprovalCard({
  approval,
  onDecision,
  canDecide,
}: {
  approval: Approval;
  onDecision: (approval: Approval, decision: "approved" | "denied") => void;
  canDecide: boolean;
}) {
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
        <button className="primary-button" disabled={!canDecide} onClick={() => onDecision(approval, "approved")}>
          <Check /> Approve
        </button>
        <button className="secondary-button" disabled={!canDecide} onClick={() => onDecision(approval, "denied")}>
          <XCircle /> Deny
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
  onDecision: (approval: Approval, decision: "approved" | "denied") => void;
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
  canDecide,
}: {
  agents: Agent[];
  approvals: Approval[];
  audit: AuditEvent[];
  operator: OperatorIdentity | null;
  live: boolean;
  onRegister: () => void;
  onDecision: (approval: Approval, decision: "approved" | "denied") => void;
  onViewApprovals: () => void;
  canDecide: boolean;
}) {
  const totalSpend = agents.reduce((sum, agent) => sum + agent.cost, 0);
  const healthyAgents = agents.filter((agent) => agent.status === "healthy").length;
  const policySummary = useMemo(() => summarizePolicyDecisions(audit), [audit]);
  const activityData = useMemo(
    () => (live ? buildSevenDayActivity(audit) : chartData),
    [audit, live],
  );
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
      <section className="metrics-band">
        <Metric icon={Bot} label="Registered agents" value={String(agents.length)} detail={`${healthyAgents} healthy`} />
        <Metric icon={ShieldCheck} label="Policy compliance" value={compliance} detail={policySummary.total ? `${policySummary.total} decisions in the current audit window` : "No policy decisions yet"} />
        <Metric icon={ClipboardCheck} label="Pending approvals" value={String(approvals.length)} detail="Requires review" />
        <Metric icon={CircleDollarSign} label="Recorded AI spend" value={money(totalSpend)} detail={`Across ${agents.length} registered agent${agents.length === 1 ? "" : "s"}`} />
      </section>
      <div className="dashboard-grid">
        <div className="dashboard-main">
          <div className="analytics-grid">
            <ActivityChart data={activityData} />
            <RiskPosture events={audit} />
          </div>
          <AgentTable agents={agents} compact />
        </div>
        <ApprovalRail approvals={approvals} onDecision={onDecision} onViewAll={onViewApprovals} canDecide={canDecide} />
      </div>
    </main>
  );
}

function AgentsView({
  agents,
  onRegister,
}: {
  agents: Agent[];
  onRegister: () => void;
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
        <span><strong>{agents.filter((a) => a.status !== "healthy").length}</strong> Need attention</span>
        <span><strong>{new Set(agents.map((a) => a.team)).size}</strong> Teams</span>
      </div>
      <AgentTable agents={agents} />
    </main>
  );
}

function ApprovalsView({
  approvals,
  onDecision,
  canDecide,
}: {
  approvals: Approval[];
  onDecision: (approval: Approval, decision: "approved" | "denied") => void;
  canDecide: boolean;
}) {
  return (
    <main className="page">
      <div className="page-title-row">
        <div><h2>Approval queue</h2><p>Review consequential actions before they reach production systems.</p></div>
        <button className="secondary-button"><SlidersHorizontal /> Routing rules</button>
      </div>
      <div className="filter-row">
        <button className="filter-chip filter-active">Pending <span>{approvals.length}</span></button>
        <button className="filter-chip">High risk</button>
        <button className="filter-chip">Assigned to me</button>
      </div>
      {approvals.length ? (
        <div className="approvals-grid">
          {approvals.map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} onDecision={onDecision} canDecide={canDecide} />
          ))}
        </div>
      ) : (
        <section className="panel">
          <EmptyState icon={CheckCircle2} title="Everything is reviewed" description="New high-impact agent actions will appear here." />
        </section>
      )}
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
  const policySummary = useMemo(() => summarizePolicyDecisions(audit), [audit]);
  const compliance = policySummary.compliancePercent === null
    ? "—"
    : `${policySummary.compliancePercent.toFixed(1)}%`;
  const decisionWidth = (count: number) =>
    policySummary.total ? `${Math.max((count / policySummary.total) * 100, count ? 8 : 0)}%` : "0%";

  function openEditor(policy: Policy | null) {
    setEditingPolicy(policy);
    setEditorOpen(true);
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <div><h2>Policy engine</h2><p>Turn governance requirements into controls that execute on every agent action.</p></div>
        <button className="primary-button primary-large" onClick={() => openEditor(null)} disabled={!canManage}><Plus /> Create policy</button>
      </div>
      <div className="policy-layout">
        <section className="panel policy-list">
          <div className="section-heading">
            <div><h2>Enforcement policies</h2><p>{policies.filter((p) => p.enabled).length} policies active</p></div>
            <button className="secondary-button"><Filter /> Filter</button>
          </div>
          {policies.map((policy) => (
            <article className="policy-row" key={policy.id}>
              <div className={`policy-icon policy-${policy.mode.toLowerCase()}`}>
                {policy.mode === "Block" ? <LockKeyhole /> : policy.mode === "Approval" ? <ClipboardCheck /> : <Activity />}
              </div>
              <div className="policy-copy">
                <div><h3>{policy.name}</h3><span className={`mode mode-${policy.mode.toLowerCase()}`}>{policy.mode}</span>{policy.activationStatus === "pending" ? <span className="mode mode-approval">Awaiting approval</span> : policy.activationStatus === "draft" ? <span className="mode mode-block">Draft v{policy.latestVersionNumber}</span> : null}</div>
                <p>{policy.description}</p>
                <small>{policy.scope} · active v{policy.activeVersionNumber ?? "none"} · latest v{policy.latestVersionNumber ?? 1} · {policy.matches} matches in 7 days</small>
              </div>
              <div className="policy-actions">
                <button
                  className="rounded-lg border border-sentinel-line px-3 py-2 text-xs font-semibold text-sentinel-muted transition hover:border-sentinel-line-strong hover:text-sentinel-text"
                  onClick={() => setHistoryPolicy(policy)}
                >
                  History
                </button>
                <button
                  className="rounded-lg border border-sentinel-line px-3 py-2 text-xs font-semibold text-sentinel-muted transition hover:border-sentinel-line-strong hover:text-sentinel-text disabled:opacity-40"
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
            </article>
          ))}
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
}: {
  audit: AuditEvent[];
  onOpenDetails: (requestId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [integrityError, setIntegrityError] = useState("");
  const [integrity, setIntegrity] = useState<{
    verified: boolean;
    eventsChecked: number;
    organizationsChecked: number;
    firstInvalidEventId: string | null;
    checkedAt: string;
  } | null>(null);
  const filtered = audit.filter((event) =>
    `${event.agent} ${event.action} ${event.actor}`.toLowerCase().includes(query.toLowerCase()),
  );

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

  return (
    <main className="page">
      <div className="page-title-row">
        <div><h2>Audit log</h2><p>An immutable record of agent actions, policy decisions, and human approvals.</p></div>
        <div className="flex items-center gap-3">
          <button
            className="primary-button"
            onClick={verifyIntegrity}
            disabled={verifying}
          >
            {verifying ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
            {verifying ? "Verifying…" : "Verify integrity"}
          </button>
          <button className="secondary-button"><ArrowDownToLine /> Export CSV</button>
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
      <section className="panel table-panel audit-table">
        <div className="section-heading table-heading">
          <label className="search-field wide-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search actions, agents, or actors…" /></label>
          <div className="table-controls"><button className="secondary-button"><Clock3 /> Today <ChevronDown /></button><button className="secondary-button"><Filter /> All results</button></div>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Timestamp</th><th>Agent</th><th>Action</th><th>Decision</th><th>Actor</th><th>Evidence</th></tr></thead>
            <tbody>
              {filtered.map((event) => (
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
        className="h-full w-full max-w-2xl overflow-y-auto border-l border-sentinel-border bg-[#0d1217] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-sentinel-border bg-[#0d1217]/95 px-7 py-6 backdrop-blur">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sentinel-lime">
              Tamper-evident record
            </span>
            <h2 id="action-detail-title" className="mt-2 text-xl font-semibold text-sentinel-text">
              Action evidence
            </h2>
            <p className="mt-1 font-mono text-xs text-sentinel-muted">
              {requestId}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close action details">
            <X />
          </button>
        </header>

        <div className="space-y-6 p-7">
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
                <section className="rounded-xl border border-sentinel-border bg-[#090d11] p-5">
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
  if (integration.name === "AWS") return <Boxes />;
  if (integration.name === "Microsoft 365") return <FileKey2 />;
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
}: {
  items: Integration[];
  live: boolean;
  canRetryDeadLetters: boolean;
  onRetryDeadLetters: () => Promise<void>;
}) {
  const [demoItems, setDemoItems] = useState(integrations);
  const [retrying, setRetrying] = useState(false);
  const visibleItems = live ? items : demoItems;
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
        <div><h2>Enterprise integrations</h2><p>Connect the systems where AI agents read data and take action.</p></div>
        <button className="secondary-button"><Plus /> Request integration</button>
      </div>
      <div className="integrations-grid">
        {visibleItems.map((integration) => (
          <article className="panel integration-card" key={integration.id}>
            <div className="integration-logo"><IntegrationLogo integration={integration} /></div>
            <div className="integration-copy">
              <div>
                <h3>{integration.name}</h3>
                {(integration.connected || integration.status === "attention") ? (
                  <span className="connected">
                    <Check /> {integrationStatusLabel(integration)}
                  </span>
                ) : null}
              </div>
              <span>{integration.category}</span>
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
              {live ? (
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
                ) : integration.connected && integration.url ? (
                  <a
                    className="secondary-button"
                    href={integration.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open repository
                  </a>
                ) : (
                  <button className="secondary-button" disabled>
                    {integration.connected ? "Configured" : "Not configured"}
                  </button>
                )
              ) : (
                <button
                  className={integration.connected ? "secondary-button" : "primary-button"}
                  onClick={() => toggle(integration.id)}
                >
                  {integration.connected ? "Configure" : "Connect"}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
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
  onRegister: (agent: Agent) => void;
}) {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [team, setTeam] = useState("Platform Engineering");
  const [provider, setProvider] = useState("OpenAI");

  if (!open) return null;
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !owner.trim()) return;
    onRegister({
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
            <label>Owner<input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Full name" required /></label>
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
    <div className="mx-7 mt-4 flex min-h-12 items-center gap-3 rounded-lg border border-[#2b333c] bg-[#0d1217] px-4 text-xs max-md:mx-4 max-md:items-start max-md:py-3">
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
}: {
  open: boolean;
  loading: boolean;
  error: string;
  onClose: () => void;
  onConnect: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("admin@sentinelops.local");
  const [password, setPassword] = useState("");
  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
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
              <h2 id="connect-live-title">Sign in to SentinelOps</h2>
              <p>
                Use your organization operator account. The browser receives an
                opaque, revocable HttpOnly session.
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
          <label>
            Password
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
          {error ? (
            <div className="security-note !border-sentinel-red/40 !bg-sentinel-red/10">
              <ShieldAlert />
              <div>
                <strong>Connection failed</strong>
                <span>{error}</span>
              </div>
            </div>
          ) : (
            <div className="security-note">
              <ShieldCheck />
              <div>
                <strong>Server-verified session</strong>
                <span>
                  Live data is protected by a revocable, role-scoped account.
                </span>
              </div>
            </div>
          )}
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={loading}
            >
              <PlugZap /> {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Toast({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, 3200);
    return () => window.clearTimeout(timer);
  }, [onClose]);
  return (
    <div className="toast" role="status">
      <CheckCircle2 />
      <span>{message}</span>
      <button onClick={onClose} aria-label="Dismiss"><X /></button>
    </div>
  );
}

export function ControlCenter() {
  const [view, setView] = useState<View>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const [auditList, setAuditList] = useState(initialAuditEvents);
  const [integrationList, setIntegrationList] = useState(integrations);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [hydrated, setHydrated] = useState(false);

  const applyLivePayload = useCallback(
    (payload: LiveControlCenterPayload) => {
      setAgentList(payload.agents);
      setApprovalList(payload.approvals);
      setPolicyList(payload.policies);
      setPolicyActivationList(payload.policyActivations);
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
    setToast(`${approval.request} was ${decision}.`);
  }

  function register(agent: Agent) {
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
    if (policy) setToast(`${policy.name} ${policy.enabled ? "disabled" : "enabled"}.`);
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
      setToast(
        error instanceof Error
          ? error.message
          : "Policy review could not be recorded.",
      );
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
        pendingCount={pendingApprovals.length}
        canManageOperators={canManageOperators}
        onSelect={setView}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="app-content">
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
            onViewApprovals={() => setView("approvals")}
            canDecide={canApprove}
          />
        )}
        {view === "agents" && (
          <AgentsView agents={agentList} onRegister={openRegisterDialog} />
        )}
        {view === "approvals" && (
          <ApprovalsView
            approvals={pendingApprovals}
            onDecision={decide}
            canDecide={canApprove}
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
          />
        )}
        {view === "integrations" && (
          <IntegrationsView
            items={integrationList}
            live={workspaceMode === "live"}
            canRetryDeadLetters={canManagePolicies}
            onRetryDeadLetters={retryDeadNotifications}
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
      {toast && <Toast message={toast} onClose={() => setToast("")} />}
    </div>
  );
}
