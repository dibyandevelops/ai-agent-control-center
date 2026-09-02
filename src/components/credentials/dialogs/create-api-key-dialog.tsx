"use client";

import { KeyRound, LoaderCircle, ShieldAlert } from "lucide-react";
import React, { useState } from "react";
import type { AgentApiKey } from "@/lib/types";
import { MfaVerificationDialog } from "@/components/mfa-verification-dialog";
import { DialogShell } from "./dialog-shell";

export const expirationOptions = [30, 60, 90, 180, 365] as const;

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none transition placeholder:text-sentinel-dim focus:border-sentinel-lime/70 focus:ring-2 focus:ring-sentinel-lime/10";

export function CreateApiKeyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (apiKey: AgentApiKey, secret: string) => void;
}) {
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mfaPromptOpen, setMfaPromptOpen] = useState(false);

  async function createApiKey() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, expiresInDays: Number(expiresInDays) }),
      });
      const payload = (await response.json()) as {
        apiKey?: AgentApiKey;
        secret?: string;
        error?: string;
      };
      if (!response.ok || !payload.apiKey || !payload.secret) {
        throw new Error(payload.error || "API key creation failed.");
      }
      onCreated(payload.apiKey, payload.secret);
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : "API key creation failed.";
      if (message.includes("Recent MFA verification")) {
        if (mfaPromptOpen) throw createError;
        setMfaPromptOpen(true);
        return;
      }
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <DialogShell
        title="Create agent API key"
        description="Use a descriptive name so operators know which workload owns this credential."
        onClose={onClose}
      >
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void createApiKey();
          }}
        >
          <label className="block text-xs font-medium text-sentinel-muted">
            Credential name
            <input
              className={fieldClass}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Production release agent"
              autoFocus
              required
              minLength={2}
              maxLength={120}
            />
          </label>
          <label className="block text-xs font-medium text-sentinel-muted">
            Credential lifetime
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
            <span className="mt-2 block text-[11px] leading-5 text-sentinel-dim">
              The agent stops authenticating automatically at this deadline unless the key is rotated first.
            </span>
          </label>
          <div className="flex items-start gap-2.5 rounded-xl border border-sentinel-amber/25 bg-sentinel-amber/10 px-3.5 py-3 text-xs leading-5 text-amber-800 dark:text-amber-100">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-amber" />
            The complete key is shown once. Store it in your secret manager, never in source code.
          </div>
          {error ? (
            <div className="rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 px-3.5 py-3 text-xs text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-3 border-t border-sentinel-line pt-5">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" disabled={submitting}>
              {submitting ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <KeyRound />
              )}
              {submitting ? "Creating…" : "Create key"}
            </button>
          </div>
        </form>
      </DialogShell>
      {mfaPromptOpen ? (
        <MfaVerificationDialog
          actionLabel="create this agent credential"
          onClose={() => setMfaPromptOpen(false)}
          onVerified={createApiKey}
        />
      ) : null}
    </>
  );
}
