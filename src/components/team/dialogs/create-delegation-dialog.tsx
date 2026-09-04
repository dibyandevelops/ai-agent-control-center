"use client";

import { LoaderCircle, ShieldCheck, X } from "lucide-react";
import React, { useState } from "react";
import type { OperatorAccount } from "@/lib/types";

export interface DelegationItem {
  id: string;
  organizationId: string;
  delegatorOperatorId: string;
  delegatorEmail: string;
  delegatorDisplayName: string;
  delegateeOperatorId: string;
  delegateeEmail: string;
  delegateeDisplayName: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  createdAt: string;
  isActive: boolean;
  status: "active" | "scheduled" | "revoked" | "expired";
}

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none transition placeholder:text-sentinel-dim focus:border-sentinel-lime/70 focus:ring-2 focus:ring-sentinel-lime/10";

export function CreateDelegationDialog({
  operators,
  onClose,
  onCreated,
}: {
  operators: OperatorAccount[];
  onClose: () => void;
  onCreated: (delegation: DelegationItem) => void;
}) {
  const [delegateeId, setDelegateeId] = useState(operators[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function applyPreset(days: number) {
    const now = new Date();
    setStartsAt(now.toISOString().slice(0, 16));
    setEndsAt(new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/v1/approver-delegations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          delegateeOperatorId: delegateeId,
          reason,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      });
      const payload = (await response.json()) as DelegationItem & { error?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Failed to create delegation.");
      }
      onCreated(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create delegation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 max-sm:items-end max-sm:p-0 bg-black/70 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-app-lg max-sm:rounded-b-none max-sm:max-h-[90dvh] max-sm:overflow-y-auto border border-sentinel-line-strong bg-sentinel-surface shadow-app-2 pb-safe"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delegation-dialog-title"
      >
        <div className="flex items-start justify-between border-b border-sentinel-line px-6 py-5">
          <div>
            <h2
              id="delegation-dialog-title"
              className="text-lg font-semibold tracking-tight text-sentinel-text"
            >
              Delegate sign-off authority
            </h2>
            <p className="mt-1 text-xs leading-5 text-sentinel-muted">
              Assign an eligible approver to sign off on consequential AI-agent actions during your absence.
            </p>
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          <label className="block text-xs font-medium text-sentinel-muted">
            Designated delegatee
            <select
              className={fieldClass}
              value={delegateeId}
              onChange={(e) => setDelegateeId(e.target.value)}
              required
            >
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.displayName} ({op.email}) — {op.role}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-sentinel-muted">
            Delegation reason
            <input
              className={fieldClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Out of office / Annual leave"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-sentinel-muted">
              Start time
              <input
                className={fieldClass}
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-medium text-sentinel-muted">
              End time
              <input
                className={fieldClass}
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-sentinel-muted">Quick presets:</span>
            <button
              type="button"
              className="secondary-button text-[11px] py-1 px-2"
              onClick={() => applyPreset(3)}
            >
              3 days
            </button>
            <button
              type="button"
              className="secondary-button text-[11px] py-1 px-2"
              onClick={() => applyPreset(7)}
            >
              7 days
            </button>
            <button
              type="button"
              className="secondary-button text-[11px] py-1 px-2"
              onClick={() => applyPreset(14)}
            >
              14 days
            </button>
          </div>

          {error ? (
            <div className="rounded-lg border border-sentinel-red/30 bg-sentinel-red/10 p-3 text-xs text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-sentinel-line pt-4">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={submitting || !reason.trim() || !delegateeId}
            >
              {submitting ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <ShieldCheck />
              )}
              Enable delegation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
