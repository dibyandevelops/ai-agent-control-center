"use client";

import {
  Check,
  Clock3,
  History,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
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
    <section className="panel overflow-hidden">
      <div className="section-heading">
        <div>
          <h2>Activation approvals</h2>
          <p>{requests.length} waiting for a second administrator</p>
        </div>
        <ShieldCheck className="h-5 w-5 text-sentinel-lime" />
      </div>
      {requests.length ? (
        <div className="divide-y divide-sentinel-line">
          {requests.map((request) => {
            const ownRequest = request.requestedByOperatorId === operatorId;
            const ready = Boolean(reasons[request.id]?.trim());
            return (
              <article className="space-y-3 py-4 first:pt-0 last:pb-0" key={request.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate text-xs font-semibold text-sentinel-text">{request.policyName}</strong>
                    <span className="mt-1 block text-[10px] text-sentinel-muted">
                      Version {request.versionNumber} · requested by {request.requestedBy}
                    </span>
                  </div>
                  <span className="mode mode-approval shrink-0">Pending</span>
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
                    <div className="grid grid-cols-2 gap-2">
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
        <div className="py-5 text-center">
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
