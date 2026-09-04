"use client";

import {
  Check,
  Shield,
  ShieldAlert,
} from "lucide-react";
import type { AuditEvent } from "@/lib/types";
import { displayTime } from "../common/ui-helpers";
import { useRiskPosture } from "@/hooks/use-risk-posture";

export function RiskPosture({
  events,
  onOpenPolicies,
}: {
  events: AuditEvent[];
  onOpenPolicies?: () => void;
}) {
  const { blockedCount, approvedCount, recentEvents } = useRiskPosture(events);

  return (
    <section className="panel risk-panel flex flex-col justify-between">
      <div>
        <div className="section-heading">
          <div>
            <h2>Live Risk Posture</h2>
            <p>Real-time intercept stream</p>
          </div>
          <span className="live-label"><span />Live</span>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-lg border border-sentinel-line/60 bg-sentinel-canvas/60 p-2">
            <span className="text-[10px] text-sentinel-muted uppercase font-bold">Interceptions</span>
            <p className="mt-0.5 font-mono text-sm font-semibold text-red-500 dark:text-red-400">
              {blockedCount} Guarded
            </p>
          </div>
          <div className="rounded-lg border border-sentinel-line/60 bg-sentinel-canvas/60 p-2">
            <span className="text-[10px] text-sentinel-muted uppercase font-bold">Sign-offs</span>
            <p className="mt-0.5 font-mono text-sm font-semibold text-sentinel-lime">
              {approvedCount} Approved
            </p>
          </div>
        </div>

        <div className="risk-timeline">
          {recentEvents.map((event) => (
            <div className="risk-event" key={event.id}>
              <span className={`timeline-marker marker-${event.result.toLowerCase()}`}>
                {event.result === "Blocked" || event.result === "Failed" ? (
                  <ShieldAlert />
                ) : (
                  <Check />
                )}
              </span>
              <time>{displayTime(event.time)}</time>
              <div className="min-w-0">
                <strong className="block max-w-full truncate" title={event.action}>
                  {event.action}
                </strong>
                <span>{event.agent}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {onOpenPolicies && (
        <button
          type="button"
          onClick={onOpenPolicies}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-sentinel-line bg-sentinel-canvas/80 py-1.5 text-xs font-semibold text-sentinel-lime transition-colors hover:border-sentinel-lime/40 hover:bg-sentinel-lime/10"
        >
          <Shield className="h-3.5 w-3.5" />
          <span>Configure Zero-Trust Policies</span>
        </button>
      )}
    </section>
  );
}
