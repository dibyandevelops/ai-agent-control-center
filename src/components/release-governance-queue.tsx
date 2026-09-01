"use client";

import {
  AlertTriangle,
  Check,
  Clock3,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  releaseGovernanceCountdown,
  releaseGovernanceUrgency,
  type ReleaseGovernanceUrgency,
} from "@/lib/release-governance-queue";
import type { ReleaseGovernanceQueueItem } from "@/lib/types";

const urgencyPresentation: Record<
  ReleaseGovernanceUrgency,
  { label: string; className: string }
> = {
  on_track: { label: "On track", className: "border-sentinel-line text-sentinel-muted" },
  urgent: { label: "Urgent", className: "border-sentinel-amber/40 bg-sentinel-amber/5 text-sentinel-amber" },
  escalated: { label: "Escalated", className: "border-red-400/40 bg-red-400/5 text-red-600 dark:text-red-300" },
  overdue: { label: "Overdue", className: "border-red-400/40 bg-red-400/5 text-red-600 dark:text-red-300" },
  executing: { label: "Worker active", className: "border-sentinel-lime/30 bg-sentinel-lime/5 text-sentinel-lime" },
  failed: { label: "Needs retry", className: "border-red-400/40 bg-red-400/5 text-red-600 dark:text-red-300" },
};

function useCurrentTime() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function ReleaseGovernanceQueue({
  items,
  operatorId,
  canGovern,
  onDecision,
  onRetry,
  onViewEvidence,
}: {
  items: ReleaseGovernanceQueueItem[];
  operatorId: string | null;
  canGovern: boolean;
  onDecision: (
    governanceId: string,
    decision: "approved" | "rejected",
    reason: string,
  ) => Promise<void>;
  onRetry: (governanceId: string) => Promise<void>;
  onViewEvidence: (requestId: string) => void;
}) {
  const now = useCurrentTime();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState("");

  async function decide(
    item: ReleaseGovernanceQueueItem,
    decision: "approved" | "rejected",
  ) {
    const note = notes[item.id]?.trim();
    if (!note || loading) return;
    setLoading(`${decision}:${item.id}`);
    try {
      await onDecision(item.id, decision, note);
      setNotes((current) => ({ ...current, [item.id]: "" }));
    } finally {
      setLoading("");
    }
  }

  async function retry(item: ReleaseGovernanceQueueItem) {
    if (loading) return;
    setLoading(`retry:${item.id}`);
    try {
      await onRetry(item.id);
    } finally {
      setLoading("");
    }
  }

  if (!items.length) {
    return (
      <section className="panel mt-6 p-8 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-sentinel-lime" />
        <h3 className="mt-4 text-base font-semibold text-sentinel-text">Release controls are clear</h3>
        <p className="mt-2 text-sm text-sentinel-muted">
          Publication and cancellation requests will appear here after a GitHub draft is created.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-sentinel-lime" />
            <h3 className="text-lg font-semibold text-sentinel-text">Release governance</h3>
            <span className="rounded-md bg-sentinel-lime/10 px-2 py-0.5 text-xs font-semibold text-sentinel-lime">
              {items.length}
            </span>
          </div>
          <p className="mt-1 text-sm text-sentinel-muted">
            Independent approval and worker recovery for GitHub draft publication or cancellation.
          </p>
        </div>
        <p className="text-xs text-sentinel-dim">Escalates inside 4 hours</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {items.map((item) => {
          const urgency = releaseGovernanceUrgency(item, now);
          const presentation = urgencyPresentation[urgency];
          const isMaker = item.requestedByOperatorId === operatorId;
          const isOverdue = urgency === "overdue";
          const note = notes[item.id] ?? "";
          return (
            <article
              key={item.id}
              className="min-w-0 rounded-2xl border border-sentinel-line bg-sentinel-panel p-5 shadow-[0_16px_50px_rgba(0,0,0,0.16)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sentinel-lime">
                    {item.operation} GitHub draft
                  </span>
                  <h4 className="mt-2 truncate text-base font-semibold text-sentinel-text" title={item.agentName}>
                    {item.agentName}
                  </h4>
                  <p className="mt-1 break-all text-xs leading-5 text-sentinel-muted">
                    {item.resource}
                  </p>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${presentation.className}`}>
                  {presentation.label}
                </span>
              </div>

              <div className="mt-4 grid gap-3 rounded-xl border border-sentinel-line bg-sentinel-canvas/55 p-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-[0.12em] text-sentinel-dim">Requested by</span>
                  <p className="mt-1 break-all text-xs text-sentinel-text">{item.requestedBy}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.12em] text-sentinel-dim">Deadline</span>
                  <p className={`mt-1 flex items-center gap-1.5 text-xs ${isOverdue ? "text-red-600 dark:text-red-300" : "text-sentinel-text"}`}>
                    <Clock3 className="h-3.5 w-3.5 shrink-0" />
                    {releaseGovernanceCountdown(item.expiresAt, now)}
                  </p>
                </div>
              </div>

              <p className="mt-4 break-words text-sm leading-6 text-sentinel-muted">
                {item.requestReason}
              </p>

              {item.executionSummary ? (
                <div className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-3 text-xs leading-5 ${item.status === "failed" ? "border-red-400/25 bg-red-400/5 text-red-700 dark:text-red-200" : "border-sentinel-line text-sentinel-muted"}`}>
                  {item.status === "failed" ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  ) : (
                    <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-sentinel-lime" />
                  )}
                  <span className="min-w-0 break-words">{item.executionSummary}</span>
                </div>
              ) : null}

              {item.status === "pending" && canGovern ? (
                isMaker ? (
                  <div className="mt-4 rounded-xl border border-sentinel-amber/25 bg-sentinel-amber/5 px-3 py-3 text-xs leading-5 text-sentinel-amber">
                    Four-eyes control: another administrator must review your request.
                  </div>
                ) : isOverdue ? (
                  <div className="mt-4 rounded-xl border border-red-400/25 bg-red-400/5 px-3 py-3 text-xs leading-5 text-red-700 dark:text-red-200">
                    This deadline has passed. Opening the request will record its expiration.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <input
                      className="h-10 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-xs text-sentinel-text outline-none placeholder:text-sentinel-dim focus:border-sentinel-lime/60"
                      value={note}
                      onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))}
                      placeholder="Independent review note (required)"
                      aria-label={`Review note for ${item.operation} ${item.resource}`}
                    />
                    <div className="grid grid-cols-2 gap-2 max-[420px]:grid-cols-1">
                      <button
                        type="button"
                        className="secondary-button justify-center"
                        disabled={!note.trim() || Boolean(loading)}
                        onClick={() => void decide(item, "rejected")}
                      >
                        <XCircle /> Reject
                      </button>
                      <button
                        type="button"
                        className="primary-button justify-center"
                        disabled={!note.trim() || Boolean(loading)}
                        onClick={() => void decide(item, "approved")}
                      >
                        {loading === `approved:${item.id}` ? <LoaderCircle className="animate-spin" /> : <Check />}
                        Approve
                      </button>
                    </div>
                  </div>
                )
              ) : null}

              {item.status === "failed" && canGovern ? (
                <button
                  type="button"
                  className="primary-button mt-4 w-full justify-center"
                  disabled={Boolean(loading)}
                  onClick={() => void retry(item)}
                >
                  <RotateCcw className={loading === `retry:${item.id}` ? "animate-spin" : undefined} />
                  Retry approved operation
                </button>
              ) : null}

              <button
                type="button"
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-sentinel-lime hover:text-sentinel-text"
                onClick={() => onViewEvidence(item.requestId)}
              >
                <ExternalLink className="h-3.5 w-3.5" /> View full evidence
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
