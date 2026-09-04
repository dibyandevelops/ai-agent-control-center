"use client";

import {
  Bot,
  CircleDollarSign,
  ClipboardCheck,
  ShieldCheck,
} from "lucide-react";
import React from "react";
import type { Agent, Approval, AuditEvent } from "@/lib/types";
import { summarizePolicyDecisions } from "@/lib/dashboard-metrics";
import { money } from "../common/ui-helpers";

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

export function MetricsDeck({
  agents,
  approvals,
  audit,
}: {
  agents: Agent[];
  approvals: Approval[];
  audit: AuditEvent[];
}) {
  const totalSpend = agents.reduce((sum, agent) => sum + agent.cost, 0);
  const healthyAgents = agents.filter((agent) => agent.status === "healthy").length;
  const policySummary = summarizePolicyDecisions(audit);
  const compliance =
    policySummary.compliancePercent === null
      ? "100.0%"
      : `${policySummary.compliancePercent.toFixed(1)}%`;

  const healthyRatio = agents.length > 0 ? (healthyAgents / agents.length) * 100 : 100;
  const complianceRatio = policySummary.compliancePercent ?? 100;

  return (
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
  );
}
