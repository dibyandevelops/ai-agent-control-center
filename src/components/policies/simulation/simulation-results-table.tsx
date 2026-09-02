"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import React from "react";

type PolicyEffect = "block" | "approval" | "allow";

export function decisionLabel(effect: PolicyEffect) {
  if (effect === "block") return "Block";
  if (effect === "approval") return "Approval";
  return "Allow";
}

export function effectBadgeClass(effect: PolicyEffect) {
  if (effect === "block")
    return "bg-sentinel-red/15 text-red-600 dark:text-red-300 border-sentinel-red/30";
  if (effect === "approval")
    return "bg-sentinel-amber/15 text-sentinel-amber border-sentinel-amber/30";
  return "bg-sentinel-lime/15 text-sentinel-lime border-sentinel-lime/30";
}

export interface SimulationRow {
  requestId: string;
  agentName: string;
  action: string;
  resource: string;
  environment: "development" | "staging" | "production";
  requestedAt: string;
  resolvedRisk: "low" | "medium" | "high";
  candidateMatches: boolean;
  candidateDetermines: boolean;
  decisionChanged: boolean;
  baselineEffect: PolicyEffect;
  simulatedEffect: PolicyEffect;
  winningPolicyName: string;
}

export function SimulationResultsTable({ rows }: { rows: SimulationRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-sentinel-muted">
        No action traces matched the active filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px]">
        <thead className="border-b border-sentinel-line/60 bg-sentinel-surface text-[10px] uppercase font-semibold text-sentinel-dim">
          <tr>
            <th className="py-2.5 px-3">Agent & Action</th>
            <th className="py-2.5 px-3">Resource & Env</th>
            <th className="py-2.5 px-3 text-center">Rule Match</th>
            <th className="py-2.5 px-3 text-center">Baseline</th>
            <th className="py-2.5 px-3 text-center">Simulated</th>
            <th className="py-2.5 px-3">Active Policy Outcome</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sentinel-line/40 font-mono">
          {rows.map((row) => (
            <tr
              key={row.requestId}
              className={`transition hover:bg-sentinel-surface/80 ${
                row.decisionChanged ? "bg-sentinel-amber/5" : ""
              }`}
            >
              <td className="py-2 px-3 font-sans">
                <strong className="block text-xs font-semibold text-sentinel-text">
                  {row.agentName}
                </strong>
                <code className="text-[10px] text-sentinel-dim">{row.action}</code>
              </td>
              <td className="py-2 px-3">
                <span className="block truncate max-w-[140px] text-sentinel-text">
                  {row.resource}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-sentinel-dim">
                  {row.environment} · {row.resolvedRisk}
                </span>
              </td>
              <td className="py-2 px-3 text-center">
                {row.candidateMatches ? (
                  <span className="inline-flex items-center gap-1 rounded bg-sentinel-lime/15 px-1.5 py-0.5 text-[9px] font-bold text-sentinel-lime border border-sentinel-lime/30">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Matched
                  </span>
                ) : (
                  <span className="text-sentinel-dim text-[10px]">—</span>
                )}
              </td>
              <td className="py-2 px-3 text-center">
                <span
                  className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${effectBadgeClass(
                    row.baselineEffect,
                  )}`}
                >
                  {decisionLabel(row.baselineEffect)}
                </span>
              </td>
              <td className="py-2 px-3 text-center">
                <div className="inline-flex items-center gap-1">
                  {row.decisionChanged ? (
                    <ArrowRight className="h-3 w-3 text-sentinel-amber" />
                  ) : null}
                  <span
                    className={`inline-block rounded border px-2 py-0.5 text-[10px] font-bold ${effectBadgeClass(
                      row.simulatedEffect,
                    )}`}
                  >
                    {decisionLabel(row.simulatedEffect)}
                  </span>
                </div>
              </td>
              <td className="py-2 px-3 font-sans text-xs text-sentinel-muted truncate max-w-[160px]">
                {row.winningPolicyName}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
