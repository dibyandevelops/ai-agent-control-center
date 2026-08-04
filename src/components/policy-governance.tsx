"use client";

import {
  ArrowRight,
  Check,
  Clock3,
  GitCompareArrows,
  History,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  TestTubeDiagonal,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  Policy,
  PolicyActivationRequest,
  PolicyVersion,
} from "@/lib/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function effectLabel(effect: "block" | "approval" | "allow") {
  if (effect === "block") return "Block";
  if (effect === "approval") return "Require approval";
  return "Allow";
}

function conditionsLabel(conditions: PolicyActivationRequest["candidate"]["conditions"]) {
  return conditions
    .map((condition) => {
      const value = Array.isArray(condition.value)
        ? condition.value.join(", ")
        : String(condition.value);
      return `${condition.field} ${condition.operator} ${value}`;
    })
    .join(" AND ");
}

function activationDiff(request: PolicyActivationRequest) {
  const active = request.active;
  const candidate = request.candidate;
  const fields = [
    { label: "Name", before: active?.name ?? "Not active", after: candidate.name },
    { label: "Description", before: active?.description ?? "Not active", after: candidate.description },
    { label: "Decision", before: active ? effectLabel(active.effect) : "Not active", after: effectLabel(candidate.effect) },
    { label: "Priority", before: active ? String(active.priority) : "Not active", after: String(candidate.priority) },
    { label: "Conditions", before: active ? conditionsLabel(active.conditions) : "Not active", after: conditionsLabel(candidate.conditions) },
  ];
  return fields.filter((field) => field.before !== field.after);
}

export function PolicyActivationQueue({
  requests,
  operatorId,
  onDecision,
}: {
  requests: PolicyActivationRequest[];
  operatorId: string;
  onDecision: (
    requestId: string,
    decision: "approved" | "rejected",
    reason: string,
  ) => Promise<void>;
}) {
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState("");

  async function decide(
    requestId: string,
    decision: "approved" | "rejected",
  ) {
    const reason = reasons[requestId]?.trim();
    if (!reason) return;
    setLoading(requestId);
    try {
      await onDecision(requestId, decision, reason);
    } finally {
      setLoading("");
    }
  }

  return (
    <section className="panel min-w-0 overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-sentinel-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-bold tracking-tight text-sentinel-text">Activation approvals</h2>
          <p className="mt-1 text-[10px] leading-4 text-sentinel-muted">{requests.length} waiting for a second administrator</p>
        </div>
        <ShieldCheck className="h-5 w-5 shrink-0 text-sentinel-lime" />
      </div>
      {requests.length ? (
        <div className="divide-y divide-sentinel-line">
          {requests.map((request) => {
            const ownRequest = request.requestedByOperatorId === operatorId;
            const ready = Boolean(reasons[request.id]?.trim());
            const diff = activationDiff(request);
            const simulation = request.simulation;
            return (
              <article className="min-w-0 space-y-4 px-5 py-5" key={request.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block break-words text-xs font-semibold leading-5 text-sentinel-text">{request.policyName}</strong>
                    <span className="mt-1 block break-words text-[10px] leading-4 text-sentinel-muted">
                      Version {request.versionNumber} · requested by {request.requestedBy}
                    </span>
                  </div>
                  <span className="mode mode-approval shrink-0">Pending</span>
                </div>
                <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas/55 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-[10px] font-semibold text-sentinel-text"><GitCompareArrows className="h-3.5 w-3.5 text-sentinel-lime" /> Change set</span>
                    <span className="text-[9px] text-sentinel-dim">v{request.activeVersionNumber ?? "none"} → v{request.versionNumber}</span>
                  </div>
                  {diff.length ? (
                    <dl className="mt-3 space-y-3">
                      {diff.map((field) => (
                        <div className="min-w-0" key={field.label}>
                          <dt className="mb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-sentinel-dim">{field.label}</dt>
                          <dd className="m-0 grid min-w-0 grid-cols-[minmax(0,1fr)_12px_minmax(0,1fr)] items-start gap-2 text-[10px] leading-4">
                            <span className="break-words text-sentinel-muted line-through decoration-sentinel-red/50">{field.before}</span>
                            <ArrowRight className="mt-0.5 h-3 w-3 text-sentinel-dim" />
                            <span className="break-words font-medium text-sentinel-text">{field.after}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="mt-3 text-[10px] text-sentinel-muted">No configuration fields changed.</p>
                  )}
                </div>
                <div className="rounded-xl border border-sentinel-lime/20 bg-sentinel-lime/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-[10px] font-semibold text-sentinel-text"><TestTubeDiagonal className="h-3.5 w-3.5 text-sentinel-lime" /> Historical simulation</span>
                    <span className="text-[9px] text-sentinel-dim">{formatDate(simulation.simulatedAt)}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <span className="rounded-lg bg-sentinel-canvas/60 p-2 text-[9px] text-sentinel-muted"><strong className="block text-sm text-sentinel-text">{simulation.actionsEvaluated}</strong>Actions replayed</span>
                    <span className="rounded-lg bg-sentinel-canvas/60 p-2 text-[9px] text-sentinel-muted"><strong className="block text-sm text-sentinel-text">{simulation.changedDecisionCount}</strong>Decisions changed</span>
                    <span className="rounded-lg bg-sentinel-canvas/60 p-2 text-[9px] text-sentinel-muted"><strong className="block text-sm text-sentinel-text">{simulation.matchedCount}</strong>Rules matched</span>
                    <span className="rounded-lg bg-sentinel-canvas/60 p-2 text-[9px] text-sentinel-muted"><strong className="block text-sm text-sentinel-text">{simulation.determiningCount}</strong>Winning decisions</span>
                  </div>
                  {simulation.changedActions.length ? (
                    <div className="mt-3 border-t border-sentinel-lime/15 pt-3">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-sentinel-dim">Changed examples</span>
                      {simulation.changedActions.slice(0, 3).map((action) => (
                        <p className="mt-2 break-words text-[9px] leading-4 text-sentinel-muted" key={action.requestId}>
                          {action.agentName} · {action.action}: {effectLabel(action.baselineEffect)} → <strong className="font-semibold text-sentinel-text">{effectLabel(action.simulatedEffect)}</strong>
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
                {ownRequest ? (
                  <div className="flex items-start gap-2 rounded-lg border border-sentinel-amber/20 bg-sentinel-amber/5 px-3 py-2 text-[10px] leading-4 text-sentinel-amber">
                    <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> A different administrator must review your request.
                  </div>
                ) : (
                  <>
                    <input
                      className="h-9 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-[11px] text-sentinel-text outline-none placeholder:text-sentinel-dim focus:border-sentinel-lime/60"
                      value={reasons[request.id] ?? ""}
                      onChange={(event) =>
                        setReasons((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                      placeholder="Review note (required)"
                      aria-label={`Review note for ${request.policyName}`}
                    />
                    <div className="grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
                      <button
                        type="button"
                        className="secondary-button justify-center"
                        disabled={!ready || Boolean(loading)}
                        onClick={() => decide(request.id, "rejected")}
                      >
                        <XCircle /> Reject
                      </button>
                      <button
                        type="button"
                        className="primary-button justify-center"
                        disabled={!ready || Boolean(loading)}
                        onClick={() => decide(request.id, "approved")}
                      >
                        {loading === request.id ? <LoaderCircle className="animate-spin" /> : <Check />}
                        Approve
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="px-5 py-6 text-center">
          <ShieldCheck className="mx-auto h-6 w-6 text-sentinel-lime" />
          <strong className="mt-2 block text-xs text-sentinel-text">No activation reviews</strong>
          <p className="mt-1 text-[10px] text-sentinel-muted">New policy versions will appear here.</p>
        </div>
      )}
    </section>
  );
}

export function PolicyHistoryDialog({
  policy,
  canManage,
  onClose,
  onChanged,
}: {
  policy: Policy;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [rollbackLoading, setRollbackLoading] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      try {
        const response = await fetch(`/api/v1/policies/${policy.id}/versions`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          versions?: PolicyVersion[];
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error || "Version history could not be loaded.");
        if (!cancelled) setVersions(payload.versions ?? []);
      } catch (historyError) {
        if (!cancelled) {
          setError(historyError instanceof Error ? historyError.message : "Version history could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [policy.id]);

  async function requestRollback(version: PolicyVersion) {
    setRollbackLoading(version.id);
    setError("");
    try {
      const response = await fetch(`/api/v1/policies/${policy.id}/rollback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionId: version.id }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Rollback could not be requested.");
      await onChanged();
      onClose();
    } catch (rollbackError) {
      setError(rollbackError instanceof Error ? rollbackError.message : "Rollback could not be requested.");
    } finally {
      setRollbackLoading("");
    }
  }

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
      <section className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-app-lg border border-sentinel-line-strong bg-sentinel-surface shadow-app-2" role="dialog" aria-modal="true" aria-labelledby="policy-history-title">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-sentinel-line bg-sentinel-surface/95 px-6 py-5 backdrop-blur">
          <div>
            <h2 id="policy-history-title" className="text-lg font-semibold text-sentinel-text">Version history</h2>
            <p className="mt-1 text-xs text-sentinel-muted">{policy.name} · active version {policy.activeVersionNumber ?? "none"}</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted" onClick={onClose} aria-label="Close version history"><X className="h-4 w-4" /></button>
        </header>
        <div className="space-y-3 p-6">
          {loading ? (
            <div className="grid min-h-40 place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-sentinel-lime" /></div>
          ) : versions.map((version) => (
            <article className={`rounded-xl border p-4 ${version.active ? "border-sentinel-lime/40 bg-sentinel-lime/5" : "border-sentinel-line bg-sentinel-raised/35"}`} key={version.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm font-semibold text-sentinel-text">Version {version.versionNumber}</strong>
                    {version.active ? <span className="mode mode-monitor">Active</span> : null}
                    {version.activation?.status === "pending" ? <span className="mode mode-approval">Pending</span> : null}
                    {version.changeType === "rollback" ? <span className="mode mode-block">Rollback</span> : null}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-sentinel-muted">{version.description}</p>
                  <p className="mt-2 text-[10px] text-sentinel-dim">
                    {version.effect} · priority {version.priority} · {version.conditions.length} conditions · {formatDate(version.createdAt)} by {version.createdBy}
                  </p>
                  {version.activation?.reviewedBy ? (
                    <p className="mt-2 text-[10px] text-sentinel-muted">Reviewed by {version.activation.reviewedBy}: {version.activation.reason}</p>
                  ) : null}
                </div>
                {!version.active && canManage ? (
                  <button
                    type="button"
                    className="secondary-button shrink-0"
                    disabled={Boolean(policy.pendingActivation) || Boolean(rollbackLoading)}
                    onClick={() => requestRollback(version)}
                  >
                    {rollbackLoading === version.id ? <LoaderCircle className="animate-spin" /> : <RotateCcw />}
                    Request rollback
                  </button>
                ) : null}
              </div>
            </article>
          ))}
          {error ? <div className="rounded-lg border border-sentinel-red/30 bg-sentinel-red/10 px-4 py-3 text-xs text-red-200">{error}</div> : null}
        </div>
        <footer className="sticky bottom-0 flex justify-end border-t border-sentinel-line bg-sentinel-surface/95 px-6 py-4 backdrop-blur">
          <button className="secondary-button" onClick={onClose}><History /> Close</button>
        </footer>
      </section>
    </div>
  );
}
