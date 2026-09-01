"use client";

import { LoaderCircle, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

export function MfaVerificationDialog({
  actionLabel,
  onClose,
  onVerified,
}: {
  actionLabel: string;
  onClose: () => void;
  onVerified: () => Promise<void>;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/v1/mfa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "MFA verification failed.");
      await onVerified();
      onClose();
    } catch (value) {
      setError(value instanceof Error ? value.message : "MFA verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        aria-labelledby="mfa-verify-title"
        aria-modal="true"
        className="dialog max-w-md"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="dialog-header">
          <div className="dialog-title">
            <ShieldCheck className="h-6 w-6 text-sentinel-lime" />
            <div>
              <h2 id="mfa-verify-title">Verify MFA</h2>
              <p>Enter an authenticator or recovery code to {actionLabel}.</p>
            </div>
          </div>
          <button aria-label="Close dialog" className="icon-button" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="p-5">
          <label className="block text-sm text-sentinel-text">
            Verification code
            <input
              autoFocus
              className="mt-2 h-11 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-base tracking-[0.2em] text-sentinel-text"
              inputMode="numeric"
              onChange={(event) => setCode(event.target.value)}
              placeholder="123456 or abcd-1234"
              value={code}
            />
          </label>
          {error ? <p className="mt-3 text-xs text-red-600 dark:text-red-300">{error}</p> : null}
          <div className="dialog-actions mt-5">
            <button className="secondary-button" onClick={onClose}>Cancel</button>
            <button
              className="primary-button"
              disabled={busy || code.trim().length < 6}
              onClick={() => void verify()}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
              Verify and continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
