"use client";

import {
  ArrowDownToLine,
  BookOpen,
  Bot,
  ExternalLink,
  Filter,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useMemo, useState } from "react";
import type { Agent, AgentStatus, AuditEvent } from "@/lib/types";
import { TablePagination } from "@/components/table-pagination";
import { AgentDetailDrawer } from "@/components/agent-detail-drawer";
import {
  EmptyState,
  executionLabel,
  money,
  Risk,
  Status,
} from "../common/ui-helpers";

export function AgentTable({
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
    const headers = [
      "Name",
      "Status",
      "Owner",
      "Team",
      "Provider",
      "Permissions",
      "7d Actions",
      "MTD Cost ($)",
      "Last Action",
      "Last Seen",
    ];
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
                            : "border-red-400/30 bg-red-400/10 text-red-600 dark:text-red-300"
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
                    <button className="icon-button row-action" aria-label={`More actions for ${agent.name}`}>
                      <MoreHorizontal />
                    </button>
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
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 max-sm:items-end max-sm:p-0 bg-black/70 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(e) => e.target === e.currentTarget && setQuarantineTarget(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-app-lg max-sm:rounded-b-none max-sm:max-h-[90dvh] max-sm:overflow-y-auto border border-sentinel-line-strong bg-sentinel-surface shadow-app-2 pb-safe"
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
                <div className="rounded-lg border border-sentinel-red/30 bg-sentinel-red/10 p-3 text-xs text-red-700 dark:text-red-200">
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

export function AgentsView({
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
        <div>
          <h2>AI agent inventory</h2>
          <p>Every autonomous system, owner, permission, and health signal in one place.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            href="/docs/connecting-agents"
            target="_blank"
            className="secondary-button text-xs py-2 px-3 flex items-center justify-center gap-1.5 w-full sm:w-auto"
          >
            <BookOpen className="h-3.5 w-3.5 text-sentinel-lime" />
            <span>Connection Docs</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
          </Link>
          <button className="primary-button primary-large w-full sm:w-auto justify-center" onClick={onRegister}>
            <Plus /> Register agent
          </button>
        </div>
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
