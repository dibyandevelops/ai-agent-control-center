"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import React from "react";
import type { Approval } from "@/lib/types";
import { EmptyState } from "../common/ui-helpers";
import { ApprovalCard } from "./approval-card";

export function ApprovalBanner({
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
  if (approvals.length === 0) return null;

  return (
    <section className="w-full rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.03] to-transparent p-3.5 sm:p-4 shadow-sm backdrop-blur-md transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400"></span>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-sentinel-text">
                Consequential Approval Gate
              </h2>
              <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400 uppercase tracking-wider shrink-0">
                {approvals.length} Action{approvals.length === 1 ? "" : "s"} Pending
              </span>
            </div>
            <p className="text-[11px] text-sentinel-muted mt-0.5 truncate">
              High-impact mutations intercepted by Zero-Trust policy requiring dual-custody human sign-off
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-400/20 transition-colors cursor-pointer shrink-0"
        >
          <span>View all ({approvals.length})</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {approvals.slice(0, 3).map((approval) => (
          <ApprovalCard
            key={approval.id}
            approval={approval}
            onDecision={onDecision}
            canDecide={canDecide}
            compact={true}
          />
        ))}
      </div>
    </section>
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
