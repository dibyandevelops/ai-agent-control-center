"use client";

import {
  Activity,
  Bot,
  CheckCircle2,
  Coins,
  Copy,
  Download,
  Lock,
  RotateCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import React, { useState } from "react";
import type { Agent, AuditEvent } from "@/lib/types";
import { OverviewTab } from "./agent-drawer/tabs/overview-tab";
import { PermissionsTab } from "./agent-drawer/tabs/permissions-tab";
import { DecisionsTab } from "./agent-drawer/tabs/decisions-tab";
import { TelemetryTab } from "./agent-drawer/tabs/telemetry-tab";

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

  if (!open || !agent) return null;

  // Filter audit records relevant to this agent
  const agentAudits = auditLogs.filter(
    (log) =>
      log.agent?.toLowerCase().includes(agent.name.toLowerCase()) ||
      agent.name.toLowerCase().includes(log.agent?.toLowerCase() || ""),
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
          {activeTab === "overview" && (
            <OverviewTab agent={agent} isQuarantined={isQuarantined} />
          )}

          {activeTab === "permissions" && <PermissionsTab agent={agent} />}

          {activeTab === "decisions" && (
            <DecisionsTab agentAudits={agentAudits} />
          )}

          {activeTab === "telemetry" && <TelemetryTab agent={agent} />}
        </div>
      </div>
    </div>
  );
}
