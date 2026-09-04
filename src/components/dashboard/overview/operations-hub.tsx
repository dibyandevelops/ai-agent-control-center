"use client";

import {
  Activity,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  FileCheck,
  Lock,
  Shield,
  ShieldCheck,
  X,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import type { Agent, AuditEvent } from "@/lib/types";
import { AgentTable } from "../views/agents-view";
import { displayTime } from "../common/ui-helpers";

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

export function OperationsHub({
  agents,
  audit,
  onOpenPolicies,
}: {
  agents: Agent[];
  audit: AuditEvent[];
  onOpenPolicies: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"fleet" | "activity" | "security">("fleet");

  return (
    <div className="rounded-2xl border border-sentinel-line/90 bg-sentinel-surface p-2 shadow-sm">
      {/* Tab Switcher & Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sentinel-line/60 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("fleet")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "fleet"
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
            onClick={() => setActiveTab("activity")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "activity"
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
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all ${
              activeTab === "security"
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
        {activeTab === "fleet" && (
          <AgentTable agents={agents} compact auditLogs={audit} />
        )}
        {activeTab === "activity" && (
          <AgentActivityFeed events={audit} agents={agents} />
        )}
        {activeTab === "security" && (
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
  );
}
