"use client";

import { LoaderCircle, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";
import React, { useState } from "react";
import type { AgentApiKey } from "@/lib/types";
import { DialogShell } from "./dialog-shell";
import { expirationOptions } from "./create-api-key-dialog";

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none transition placeholder:text-sentinel-dim focus:border-sentinel-lime/70 focus:ring-2 focus:ring-sentinel-lime/10";

export function ConfirmApiKeyActionDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: { apiKey: AgentApiKey; action: "rotate" | "revoke" };
  onClose: () => void;
  onConfirm: (expiresInDays?: number) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const rotating = target.action === "rotate";

  async function confirm() {
    setLoading(true);
    setError("");
    try {
      await onConfirm(rotating ? Number(expiresInDays) : undefined);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Credential update failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogShell
      title={`${rotating ? "Rotate" : "Revoke"} API key`}
      description={`${target.apiKey.name} · ${target.apiKey.keyPrefix}••••••••`}
      onClose={onClose}
    >
      <div className="space-y-5">
        <p className="text-sm leading-6 text-sentinel-muted">
          {rotating
            ? "A new key will be generated and the current credential will stop working immediately. Update the agent before its next request."
            : "This credential will stop authenticating immediately. This action cannot be undone."}
        </p>
        {rotating ? (
          <label className="block text-xs font-medium text-sentinel-muted">
            New credential lifetime
            <select
              className={fieldClass}
              value={expiresInDays}
              onChange={(event) => setExpiresInDays(event.target.value)}
            >
              {expirationOptions.map((days) => (
                <option key={days} value={days}>
                  {days} days{days === 90 ? " · recommended" : ""}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="flex items-start gap-2.5 rounded-xl border border-sentinel-amber/25 bg-sentinel-amber/10 px-3.5 py-3 text-xs leading-5 text-amber-800 dark:text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-amber" />
          Confirm the workload owner is ready for this interruption.
        </div>
        {error ? (
          <div className="rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 px-3.5 py-3 text-xs text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}
        <div className="flex justify-end gap-3 border-t border-sentinel-line pt-5">
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className={
              rotating
                ? "primary-button"
                : "inline-flex h-10 items-center gap-2 rounded-xl border border-sentinel-red/40 bg-sentinel-red/10 px-4 text-xs font-semibold text-red-700 dark:text-red-200 transition hover:bg-sentinel-red/20"
            }
            onClick={() => void confirm()}
            disabled={loading}
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : rotating ? (
              <RefreshCw className="h-4 w-4" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {loading
              ? `${rotating ? "Rotating" : "Revoking"}…`
              : rotating
                ? "Rotate key"
                : "Revoke key"}
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
