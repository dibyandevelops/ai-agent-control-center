"use client";

import React from "react";
import type { Agent } from "@/lib/types";

export function TelemetryTab({ agent }: { agent: Agent }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-sentinel-border bg-sentinel-canvas/50 p-4">
          <span className="text-[11px] font-semibold text-sentinel-muted">
            Monthly Spend Cap
          </span>
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
          <span className="text-[11px] font-semibold text-sentinel-muted">
            P95 Policy Latency
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <strong className="font-mono text-xl font-bold text-sentinel-text">
              4.2 ms
            </strong>
            <span className="text-[10px] text-sentinel-success">
              Fast (Edge cached)
            </span>
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
            <strong className="block mt-1 font-mono text-sm text-sentinel-text">
              1.4M
            </strong>
          </div>
          <div className="rounded-xl border border-sentinel-border bg-sentinel-surface p-2.5">
            <span className="text-[10px] text-sentinel-muted">
              Completion Tokens
            </span>
            <strong className="block mt-1 font-mono text-sm text-sentinel-text">
              380K
            </strong>
          </div>
          <div className="rounded-xl border border-sentinel-border bg-sentinel-surface p-2.5">
            <span className="text-[10px] text-sentinel-muted">Cache Hit Rate</span>
            <strong className="block mt-1 font-mono text-sm text-sentinel-success">
              92.4%
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
