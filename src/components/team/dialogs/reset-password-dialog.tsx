"use client";

import { Check, Copy, KeyRound, LoaderCircle, ShieldAlert, ShieldCheck, X } from "lucide-react";
import React, { useState } from "react";
import type { OperatorAccount } from "@/lib/types";

export function ResetPasswordDialog({
  operator,
  onClose,
  onReset,
}: {
  operator: OperatorAccount;
  onClose: () => void;
  onReset: () => Promise<string>;
}) {
  const [loading, setLoading] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function reset() {
    setLoading(true);
    setError("");
    try {
      const password = await onReset();
      setTemporaryPassword(password);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : "Password reset failed.");
    } finally {
      setLoading(false);
    }
  }

  async function copyPassword() {
    if (!temporaryPassword) return;
    try {
      await navigator.clipboard.writeText(temporaryPassword);
      setCopied(true);
    } catch {
      setError("Copy failed. Select the temporary password manually.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
      role="presentation"
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-app-lg border border-sentinel-line-strong bg-sentinel-surface shadow-app-2"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-reset-title"
      >
        <div className="flex items-start justify-between border-b border-sentinel-line px-6 py-5">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sentinel-amber/25 bg-sentinel-amber/10 text-sentinel-amber">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2
                id="password-reset-title"
                className="text-lg font-semibold tracking-tight text-sentinel-text"
              >
                Reset operator password
              </h2>
              <p className="mt-1 text-xs leading-5 text-sentinel-muted">
                {operator.displayName} · {operator.email}
              </p>
            </div>
          </div>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text"
            onClick={onClose}
            aria-label="Close password reset dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-5 px-6 py-5">
          {temporaryPassword ? (
            <>
              <div className="flex items-start gap-2.5 rounded-xl border border-sentinel-lime/25 bg-sentinel-lime/10 px-3.5 py-3 text-xs leading-5 text-sentinel-text">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-lime" />
                Reset complete. Every previous session is revoked and this credential must be replaced at the next login.
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sentinel-dim">
                  Temporary password · shown once
                </span>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-sentinel-line-strong bg-sentinel-canvas p-2">
                  <code className="min-w-0 flex-1 overflow-x-auto px-2 font-mono text-xs text-sentinel-text">
                    {temporaryPassword}
                  </code>
                  <button
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text"
                    onClick={() => void copyPassword()}
                    aria-label={copied ? "Temporary password copied" : "Copy temporary password"}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-sentinel-lime" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-sentinel-muted">
                SentinelOps will generate a high-entropy temporary password. Resetting immediately signs this operator out everywhere and clears any login lock.
              </p>
              <div className="flex items-start gap-2.5 rounded-xl border border-sentinel-amber/25 bg-sentinel-amber/10 px-3.5 py-3 text-xs leading-5 text-amber-800 dark:text-amber-100">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-amber" />
                Verify the operator&apos;s identity before sharing the credential through a secure channel.
              </div>
            </>
          )}
          {error ? (
            <div className="rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 px-3.5 py-3 text-xs text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-3 border-t border-sentinel-line pt-5">
            {temporaryPassword ? (
              <button className="primary-button" onClick={onClose}>
                Done
              </button>
            ) : (
              <>
                <button className="secondary-button" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="primary-button"
                  onClick={() => void reset()}
                  disabled={loading}
                >
                  {loading ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
                  {loading ? "Resetting…" : "Generate temporary password"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
