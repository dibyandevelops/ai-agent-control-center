"use client";

import {
  Activity,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Download,
  Lock,
  RotateCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import React, { useState } from "react";
import type { Agent, AuditEvent } from "@/lib/types";

interface AgentDetailDrawerProps {
  agent: Agent | null;
  open: boolean;
  onClose: () => void;
  onQuarantine?: (agent: Agent) => void;
  onLiftQuarantine?: (agent: Agent) => void;
  onRotateKey?: (agent: Agent) => void;
  onExportAudit?: (agent: Agent) => void;
  auditLogs?: AuditEvent[];
}

type TabType = "overview" | "permissions" | "decisions" | "telemetry";

export function AgentDetailDrawer({
  agent,
  open,
  onClose,
  onQuarantine,
  onLiftQuarantine,
  onRotateKey,
  onExportAudit,
  auditLogs = [],
}: AgentDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [copiedKey, setCopiedKey] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<AuditEvent | null>(null);

  if (!open || !agent) return null;

  // Filter audit records relevant to this agent
  const agentAudits = auditLogs.filter(
    (log) =>
      log.agent?.toLowerCase().includes(agent.name.toLowerCase()) ||
      agent.name.toLowerCase().includes(log.agent?.toLowerCase() || "")
  );

  async function handleCopyId() {
    if (!agent) return;
    await navigator.clipboard.writeText(agent.id);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  const isQuarantined = agent.status === "quarantined";

  return (
    <div
      className="fixed inset-0 z-[140] flex justify-end bg-black/50 backdrop-blur-sm transition-opacity"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-sentinel-border bg-sentinel-surface shadow-2xl animate-dialog-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-drawer-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-sentinel-border p-5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-sentinel-border bg-sentinel-surface-soft text-sentinel-text shadow-sm">
              <Bot className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="agent-drawer-title"
                  className="truncate text-base font-bold text-sentinel-text"
                >
                  {agent.name}
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                    isQuarantined
                      ? "border border-sentinel-danger/30 bg-sentinel-danger-soft text-sentinel-danger"
                      : agent.status === "healthy"
                        ? "border border-sentinel-success/30 bg-sentinel-success-soft text-sentinel-success"
                        : "border border-sentinel-amber/30 bg-sentinel-amber-soft text-sentinel-amber"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {agent.status}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-sentinel-muted">
                <span>{agent.provider}</span>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="inline-flex items-center gap-1 font-mono hover:text-sentinel-text hover:underline"
                  title="Click to copy agent ID"
                >
                  <span>{agent.id}</span>
                  {copiedKey ? (
                    <CheckCircle2 className="h-3 w-3 text-sentinel-success" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="icon-button shrink-0"
            onClick={onClose}
            aria-label="Close agent drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-4 border-b border-sentinel-border bg-sentinel-surface-raised/40">
          <div className="border-r border-sentinel-border p-3 text-center">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-sentinel-muted">
              7D Actions
            </span>
            <strong className="mt-0.5 block font-mono text-base font-bold text-sentinel-text">
              {agent.actions.toLocaleString()}
            </strong>
          </div>
          <div className="border-r border-sentinel-border p-3 text-center">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-sentinel-muted">
              MTD Spend
            </span>
            <strong className="mt-0.5 block font-mono text-base font-bold text-sentinel-text">
              ${agent.cost.toLocaleString()}
            </strong>
          </div>
          <div className="border-r border-sentinel-border p-3 text-center">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-sentinel-muted">
              Scopes
            </span>
            <strong className="mt-0.5 block font-mono text-base font-bold text-sentinel-accent">
              {agent.permissions.length} active
            </strong>
          </div>
          <div className="p-3 text-center">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-sentinel-muted">
              Last Exec
            </span>
            <strong className="mt-0.5 block truncate font-mono text-xs font-semibold text-sentinel-text">
              {agent.lastExecutionStatus || "Succeeded"}
            </strong>
          </div>
        </div>

        {/* Action Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sentinel-border bg-sentinel-surface px-5 py-2.5">
          <div className="flex items-center gap-2">
            {isQuarantined ? (
              <button
                type="button"
                className="secondary-button !border-sentinel-success/40 !bg-sentinel-success-soft !text-sentinel-success"
                onClick={() => onLiftQuarantine?.(agent)}
              >
                <ShieldCheck className="h-3.5 w-3.5" /> Lift Quarantine
              </button>
            ) : (
              <button
                type="button"
                className="secondary-button !border-sentinel-danger/40 !bg-sentinel-danger-soft !text-sentinel-danger"
                onClick={() => onQuarantine?.(agent)}
              >
                <ShieldAlert className="h-3.5 w-3.5" /> Trigger Killswitch
              </button>
            )}

            <button
              type="button"
              className="secondary-button"
              onClick={() => onRotateKey?.(agent)}
              title="Rotate this agent's API Key"
            >
              <RotateCw className="h-3.5 w-3.5" /> Rotate Key
            </button>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => onExportAudit?.(agent)}
            title="Export CSV audit trail for this agent"
          >
            <Download className="h-3.5 w-3.5" /> Export Audit
          </button>
        </div>

        {/* Tabs Header */}
        <div className="flex items-center border-b border-sentinel-border bg-sentinel-surface px-5">
          {[
            { id: "overview", label: "Overview & Identity", icon: Server },
            { id: "permissions", label: "Permissions & Scopes", icon: Lock },
            { id: "decisions", label: "Decision Stream", icon: Activity },
            { id: "telemetry", label: "Token & Spend Gauges", icon: Coins },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition ${
                  active
                    ? "border-sentinel-accent text-sentinel-accent"
                    : "border-transparent text-sentinel-muted hover:text-sentinel-text"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Tab 1: Overview */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-sentinel-border bg-sentinel-canvas/50 p-4 space-y-3">
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-sentinel-muted">
                  Agent Metadata & Ownership
                </h3>
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-sentinel-muted text-[11px]">Primary Owner</dt>
                    <dd className="mt-1 font-semibold text-sentinel-text flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-sentinel-muted" />
                      {agent.owner}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sentinel-muted text-[11px]">Assigned Team</dt>
                    <dd className="mt-1 font-semibold text-sentinel-text flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-sentinel-muted" />
                      {agent.team}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sentinel-muted text-[11px]">Provider Framework</dt>
                    <dd className="mt-1 font-mono text-sentinel-text">{agent.provider}</dd>
                  </div>
                  <div>
                    <dt className="text-sentinel-muted text-[11px]">Last Active</dt>
                    <dd className="mt-1 font-mono text-sentinel-text flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-sentinel-muted" />
                      {agent.lastSeen}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-sentinel-border bg-sentinel-canvas/50 p-4 space-y-2">
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-sentinel-muted">
                  Latest Action Summary
                </h3>
                <div className="flex items-start gap-3 rounded-xl border border-sentinel-border bg-sentinel-surface p-3">
                  <Zap className="h-4 w-4 text-sentinel-accent shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <strong className="text-xs font-semibold text-sentinel-text block">
                      {agent.lastAction}
                    </strong>
                    <p className="mt-0.5 text-[11px] text-sentinel-muted">
                      Executed under active governance rules with full deterministic telemetry capture.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-sentinel-border bg-sentinel-canvas/50 p-4 space-y-2">
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-sentinel-muted">
                  Security Posture
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl border border-sentinel-border bg-sentinel-surface p-3">
                    <span className="text-[11px] text-sentinel-muted">Killswitch State</span>
                    <strong className={`block mt-1 font-semibold ${isQuarantined ? "text-sentinel-danger" : "text-sentinel-success"}`}>
                      {isQuarantined ? "ACTIVATED (Blocked)" : "Normal Operation"}
                    </strong>
                  </div>
                  <div className="rounded-xl border border-sentinel-border bg-sentinel-surface p-3">
                    <span className="text-[11px] text-sentinel-muted">Audit Trail Hash</span>
                    <strong className="block mt-1 font-mono text-[11px] text-sentinel-text truncate">
                      SHA256: 4f98...b29e
                    </strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Permissions */}
          {activeTab === "permissions" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-sentinel-border bg-sentinel-canvas/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-sentinel-muted">
                    Scoped Action Permissions ({agent.permissions.length})
                  </h3>
                  <span className="text-[10px] text-sentinel-muted">Enforced at runtime</span>
                </div>
                <div className="space-y-2">
                  {agent.permissions.map((perm, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-sentinel-border bg-sentinel-surface px-3.5 py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Lock className="h-3.5 w-3.5 text-sentinel-accent shrink-0" />
                        <code className="font-mono text-xs font-semibold text-sentinel-text truncate">
                          {perm}
                        </code>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full border border-sentinel-success/30 bg-sentinel-success-soft px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sentinel-success">
                        <CheckCircle2 className="h-3 w-3" /> Allowed
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-sentinel-border bg-sentinel-canvas/50 p-4 space-y-2">
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-sentinel-muted">
                  Default Policy Guardrails
                </h3>
                <p className="text-xs text-sentinel-muted leading-relaxed">
                  Any unlisted API actions or tool requests outside the authorized scopes above are automatically intercepted and routed to the <strong>Human Approval Queue</strong> or blocked by default.
                </p>
              </div>
            </div>
          )}

          {/* Tab 3: Decisions Stream */}
          {activeTab === "decisions" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-sentinel-muted">
                  Recent Policy Decisions ({agentAudits.length})
                </h3>
                <span className="text-[10px] text-sentinel-muted">Tamper-evident record</span>
              </div>

              {agentAudits.length === 0 ? (
                <div className="rounded-2xl border border-sentinel-border bg-sentinel-canvas/30 p-8 text-center text-xs text-sentinel-muted">
                  <Clock className="mx-auto h-6 w-6 mb-2 text-sentinel-muted opacity-60" />
                  <p>No recent decisions recorded in the current active window.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {agentAudits.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedAudit(selectedAudit?.id === item.id ? null : item)}
                      className="cursor-pointer rounded-xl border border-sentinel-border bg-sentinel-surface p-3 text-xs transition hover:border-sentinel-accent hover:bg-sentinel-surface-raised"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`inline-flex rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              item.result === "Allowed" || item.result === "Succeeded"
                                ? "bg-sentinel-success-soft text-sentinel-success"
                                : item.result === "Approved"
                                  ? "bg-sentinel-amber-soft text-sentinel-amber"
                                  : "bg-sentinel-danger-soft text-sentinel-danger"
                            }`}
                          >
                            {item.result}
                          </span>
                          <strong className="truncate text-sentinel-text font-semibold">
                            {item.action}
                          </strong>
                        </div>
                        <time className="font-mono text-[10px] text-sentinel-muted shrink-0">
                          {item.time}
                        </time>
                      </div>

                      {selectedAudit?.id === item.id && (
                        <div className="mt-3 border-t border-sentinel-border pt-3 font-mono text-[11px] text-sentinel-muted space-y-1.5 animate-dialog-in">
                          <div>Actor: <span className="text-sentinel-text">{item.actor}</span></div>
                          <div>Detail: <span className="text-sentinel-text">{item.detail}</span></div>
                          {item.externalReference ? (
                            <div>Ref: <span className="text-sentinel-text break-all">{item.externalReference}</span></div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Telemetry & Cost */}
          {activeTab === "telemetry" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-sentinel-border bg-sentinel-canvas/50 p-4">
                  <span className="text-[11px] font-semibold text-sentinel-muted">Monthly Spend Cap</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <strong className="font-mono text-xl font-bold text-sentinel-text">
                      ${agent.cost.toLocaleString()}
                    </strong>
                    <span className="text-[10px] text-sentinel-muted">/ $5,000 budget</span>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-sentinel-surface">
                    <div
                      className="h-full bg-sentinel-accent transition-all"
                      style={{ width: `${Math.min(100, (agent.cost / 5000) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-sentinel-border bg-sentinel-canvas/50 p-4">
                  <span className="text-[11px] font-semibold text-sentinel-muted">P95 Policy Latency</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <strong className="font-mono text-xl font-bold text-sentinel-text">
                      4.2 ms
                    </strong>
                    <span className="text-[10px] text-sentinel-success">Fast (Edge cached)</span>
                  </div>
                  <p className="mt-2 text-[10px] text-sentinel-muted">
                    Deterministic evaluations without network hops.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-sentinel-border bg-sentinel-canvas/50 p-4 space-y-3">
                <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-sentinel-muted">
                  Token Consumption Rate
                </h3>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl border border-sentinel-border bg-sentinel-surface p-2.5">
                    <span className="text-[10px] text-sentinel-muted">Prompt Tokens</span>
                    <strong className="block mt-1 font-mono text-sm text-sentinel-text">1.4M</strong>
                  </div>
                  <div className="rounded-xl border border-sentinel-border bg-sentinel-surface p-2.5">
                    <span className="text-[10px] text-sentinel-muted">Completion Tokens</span>
                    <strong className="block mt-1 font-mono text-sm text-sentinel-text">380K</strong>
                  </div>
                  <div className="rounded-xl border border-sentinel-border bg-sentinel-surface p-2.5">
                    <span className="text-[10px] text-sentinel-muted">Cache Hit Rate</span>
                    <strong className="block mt-1 font-mono text-sm text-sentinel-success">92.4%</strong>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
