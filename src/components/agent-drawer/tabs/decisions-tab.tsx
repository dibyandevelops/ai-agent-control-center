"use client";

import { Clock } from "lucide-react";
import React, { useState } from "react";
import type { AuditEvent } from "@/lib/types";

export function DecisionsTab({ agentAudits }: { agentAudits: AuditEvent[] }) {
  const [selectedAudit, setSelectedAudit] = useState<AuditEvent | null>(null);

  return (
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
              onClick={() =>
                setSelectedAudit(selectedAudit?.id === item.id ? null : item)
              }
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
                  <div>
                    Actor: <span className="text-sentinel-text">{item.actor}</span>
                  </div>
                  <div>
                    Detail: <span className="text-sentinel-text">{item.detail}</span>
                  </div>
                  {item.externalReference ? (
                    <div>
                      Ref:{" "}
                      <span className="text-sentinel-text break-all">
                        {item.externalReference}
                      </span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
