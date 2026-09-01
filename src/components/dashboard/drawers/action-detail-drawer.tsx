"use client";

import {
  Check,
  ExternalLink,
  FileClock,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { ActionDetail, RiskLevel } from "@/lib/types";

function Risk({ risk }: { risk: RiskLevel }) {
  return (
    <span
      className={`risk-badge ${
        risk === "high"
          ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300"
          : risk === "medium"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300"
            : "border-sentinel-lime/30 bg-sentinel-lime/10 text-sentinel-lime"
      }`}
    >
      {risk.toUpperCase()}
    </span>
  );
}

export function ActionDetailDrawer({
  requestId,
  onClose,
  canRetryExecution,
  onExecutionRetried,
  onNotify,
  operatorId,
  canGovernReleases,
}: {
  requestId: string | null;
  onClose: () => void;
  canRetryExecution: boolean;
  onExecutionRetried: () => Promise<void>;
  onNotify: (message: string) => void;
  operatorId: string | null;
  canGovernReleases: boolean;
}) {
  const [detail, setDetail] = useState<ActionDetail | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(requestId));
  const [retrying, setRetrying] = useState(false);
  const [refreshSequence, setRefreshSequence] = useState(0);
  const [governanceReason, setGovernanceReason] = useState("");
  const [governanceLoading, setGovernanceLoading] = useState("");

  useEffect(() => {
    if (!requestId) return;
    const controller = new AbortController();

    async function loadDetail() {
      try {
        const response = await fetch(
          `/api/v1/actions/${requestId}/details`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = (await response.json()) as ActionDetail & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error || "Unable to load action evidence.");
        }
        setDetail(payload);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load action evidence.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadDetail();
    return () => controller.abort();
  }, [requestId, refreshSequence]);

  async function retryExecution() {
    if (!requestId || !canRetryExecution || retrying) return;
    setRetrying(true);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/actions/${requestId}/execution/retry`,
        { method: "POST" },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Execution could not be retried.");
      }
      await onExecutionRetried();
      setDetail((current) =>
        current
          ? {
              ...current,
              execution: {
                ...current.execution,
                status: "not_started",
                summary: "Retry queued. The execution worker is starting.",
                errorCode: null,
                startedAt: null,
                completedAt: null,
                externalReference: null,
              },
            }
          : current,
      );
      onNotify("Release execution was safely requeued.");
      window.setTimeout(() => setRefreshSequence((value) => value + 1), 1_000);
    } catch (retryError) {
      setError(
        retryError instanceof Error
          ? retryError.message
          : "Execution could not be retried.",
      );
    } finally {
      setRetrying(false);
    }
  }

  async function requestDraftGovernance(operation: "publish" | "cancel") {
    if (!requestId || !governanceReason.trim() || governanceLoading) return;
    setGovernanceLoading(`request-${operation}`);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/actions/${requestId}/draft-governance`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ operation, reason: governanceReason.trim() }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Draft governance request could not be created.");
      }
      setGovernanceReason("");
      await onExecutionRetried();
      setRefreshSequence((value) => value + 1);
      onNotify(
        `${operation === "publish" ? "Publication" : "Cancellation"} now requires a second administrator.`,
      );
    } catch (governanceError) {
      setError(
        governanceError instanceof Error
          ? governanceError.message
          : "Draft governance request could not be created.",
      );
    } finally {
      setGovernanceLoading("");
    }
  }

  async function decideDraftGovernance(
    governanceId: string,
    decision: "approved" | "rejected",
  ) {
    if (!governanceReason.trim() || governanceLoading) return;
    setGovernanceLoading(`${decision}-${governanceId}`);
    setError("");
    try {
      const response = await fetch(
        `/api/v1/release-governance/${governanceId}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision, reason: governanceReason.trim() }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Governance decision could not be recorded.");
      }
      setGovernanceReason("");
      await onExecutionRetried();
      setRefreshSequence((value) => value + 1);
      window.setTimeout(() => setRefreshSequence((value) => value + 1), 1_000);
      onNotify(`Draft operation was ${decision}.`);
    } catch (governanceError) {
      setError(
        governanceError instanceof Error
          ? governanceError.message
          : "Governance decision could not be recorded.",
      );
    } finally {
      setGovernanceLoading("");
    }
  }

  useEffect(() => {
    if (!requestId) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, requestId]);

  if (!requestId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/65 backdrop-blur-sm"
      role="presentation"
      onMouseDown={onClose}
    >
      <aside
        className="h-full w-full max-w-2xl overflow-y-auto border-l border-sentinel-line bg-sentinel-surface shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-sentinel-line bg-sentinel-surface/95 px-4 sm:px-7 py-4 sm:py-6 backdrop-blur">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sentinel-lime">
              Tamper-evident record
            </span>
            <h2 id="action-detail-title" className="mt-1 sm:mt-2 text-lg sm:text-xl font-semibold text-sentinel-text">
              Action evidence
            </h2>
            <p className="mt-1 font-mono text-[11px] sm:text-xs text-sentinel-muted break-all">
              {requestId}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close action details">
            <X />
          </button>
        </header>

        <div className="space-y-4 sm:space-y-6 p-4 sm:p-7">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-sentinel-muted">
              <LoaderCircle className="h-5 w-5 animate-spin text-sentinel-lime" />
              Loading evidence…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : detail ? (
            <>
              <section className="rounded-xl border border-sentinel-border bg-sentinel-surface-raised/40 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-sentinel-text">{detail.action}</h3>
                    <p className="mt-1 break-all text-sm text-sentinel-muted">{detail.resource}</p>
                  </div>
                  <Risk risk={detail.risk} />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4 text-xs max-sm:grid-cols-1">
                  <div>
                    <dt className="text-sentinel-muted">Agent</dt>
                    <dd className="mt-1 font-semibold text-sentinel-text">{detail.agent.name}</dd>
                  </div>
                  <div>
                    <dt className="text-sentinel-muted">Environment</dt>
                    <dd className="mt-1 font-semibold capitalize text-sentinel-text">{detail.environment}</dd>
                  </div>
                  <div>
                    <dt className="text-sentinel-muted">Owner</dt>
                    <dd className="mt-1 font-semibold text-sentinel-text">{detail.agent.owner}</dd>
                  </div>
                  <div>
                    <dt className="text-sentinel-muted">Requested</dt>
                    <dd className="mt-1 font-semibold text-sentinel-text">{new Date(detail.requestedAt).toLocaleString()}</dd>
                  </div>
                </dl>
              </section>

              <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                <section className="rounded-xl border border-sentinel-border bg-sentinel-surface-raised/40 p-5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sentinel-muted">Decision</span>
                  <h3 className="mt-2 text-base font-semibold capitalize text-sentinel-text">{detail.decision.status}</h3>
                  <p className="mt-2 text-xs leading-5 text-sentinel-muted">{detail.decision.reason}</p>
                  <div className="mt-4 border-t border-sentinel-border pt-3 text-xs text-sentinel-muted">
                    {detail.decision.policyName || "Safety default"}
                    {detail.decision.decidedBy ? ` · ${detail.decision.decidedBy}` : ""}
                  </div>
                </section>
                <section className="rounded-xl border border-sentinel-border bg-sentinel-surface-raised/40 p-5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sentinel-muted">Execution</span>
                  <h3 className="mt-2 text-base font-semibold capitalize text-sentinel-text">{detail.execution.status.replace("_", " ")}</h3>
                  <p className="mt-2 text-xs leading-5 text-sentinel-muted">{detail.execution.summary || "No execution outcome reported."}</p>
                  {detail.execution.errorCode ? (
                    <div className="mt-4 rounded-lg border border-red-400/25 bg-red-400/10 p-3">
                      <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-red-600 dark:text-red-300">
                        Failure code
                      </span>
                      <code className="mt-1 block break-all text-[11px] text-red-800 dark:text-red-100">
                        {detail.execution.errorCode}
                      </code>
                    </div>
                  ) : null}
                  {detail.execution.externalReference?.startsWith("https://github.com/") ? (
                    <a className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-sentinel-lime" href={detail.execution.externalReference} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Open GitHub evidence
                    </a>
                  ) : detail.execution.externalReference?.startsWith("dry-run://") ? (
                    <code
                      className="mt-4 block break-all text-[10px] text-sentinel-lime"
                      title="No external write was performed"
                    >
                      {detail.execution.externalReference}
                    </code>
                  ) : null}
                  {detail.execution.status === "failed" ? (
                    <button
                      type="button"
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-sentinel-lime px-4 py-2.5 text-xs font-bold text-[#08100b] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={!canRetryExecution || retrying}
                      title={canRetryExecution ? undefined : "Admin role required"}
                      onClick={() => void retryExecution()}
                    >
                      {retrying ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <RotateCcw className="h-4 w-4" />
                      )}
                      {retrying ? "Requeuing…" : "Retry execution"}
                    </button>
                  ) : null}
                </section>
              </div>

              <section>
                <div className="mb-4 flex items-center gap-2">
                  <FileClock className="h-4 w-4 text-sentinel-lime" />
                  <h3 className="text-sm font-semibold text-sentinel-text">Evidence timeline</h3>
                </div>
                <div className="space-y-3 border-l border-sentinel-border pl-5">
                  {detail.timeline.map((event) => (
                    <article className="relative rounded-lg border border-sentinel-border bg-sentinel-surface-raised/40 p-4" key={event.id}>
                      <span className="absolute -left-[25px] top-5 h-2 w-2 rounded-full bg-sentinel-lime shadow-[0_0_10px_rgba(183,243,74,0.5)]" />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-xs font-semibold text-sentinel-text">{event.eventType}</strong>
                        <time className="font-mono text-[10px] text-sentinel-muted">{new Date(event.time).toLocaleString()}</time>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-sentinel-muted">{event.detail}</p>
                      <span className="mt-2 block text-[10px] uppercase tracking-[0.1em] text-sentinel-muted">{event.actorType} · {event.actor}</span>
                    </article>
                  ))}
                </div>
              </section>

              {Object.keys(detail.context).length > 0 ? (
                <section className="rounded-xl border border-sentinel-line bg-sentinel-surface-raised/30 p-5">
                  <h3 className="text-sm font-semibold text-sentinel-text">Request context</h3>
                  <dl className="mt-4 space-y-2 font-mono text-xs">
                    {Object.entries(detail.context).map(([key, value]) => (
                      <div className="flex items-start justify-between gap-5" key={key}>
                        <dt className="text-sentinel-muted">{key}</dt>
                        <dd className="break-all text-right text-sentinel-text">{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
