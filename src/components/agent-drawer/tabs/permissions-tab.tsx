"use client";

import { CheckCircle2, Lock } from "lucide-react";
import React from "react";
import type { Agent } from "@/lib/types";

export function PermissionsTab({ agent }: { agent: Agent }) {
  return (
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
  );
}
