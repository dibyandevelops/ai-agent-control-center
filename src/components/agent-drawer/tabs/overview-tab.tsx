"use client";

import { Clock, User, Users, Zap } from "lucide-react";
import React from "react";
import type { Agent } from "@/lib/types";

export function OverviewTab({
  agent,
  isQuarantined,
}: {
  agent: Agent;
  isQuarantined: boolean;
}) {
  return (
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
            <strong
              className={`block mt-1 font-semibold ${
                isQuarantined ? "text-sentinel-danger" : "text-sentinel-success"
              }`}
            >
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
  );
}
