"use client";

import { KeyRound, LoaderCircle, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useState } from "react";

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none transition placeholder:text-sentinel-dim focus:border-sentinel-lime/70 focus:ring-2 focus:ring-sentinel-lime/10";

export function PasswordChangeDialog({
  required,
  loading,
  serverError,
  onClose,
  onSubmit,
}: {
  required: boolean;
  loading: boolean;
  serverError: string;
  onClose: () => void;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [validationError, setValidationError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");
    if (newPassword !== confirmation) {
      setValidationError("The new password confirmation does not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setValidationError("Choose a password different from the current password.");
      return;
    }
    await onSubmit(currentPassword, newPassword);
  }

  const error = validationError || serverError;
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 max-sm:items-end max-sm:p-0 bg-black/75 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (!required && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-app-lg max-sm:rounded-b-none max-sm:max-h-[90dvh] max-sm:overflow-y-auto border border-sentinel-line-strong bg-sentinel-surface shadow-app-2 pb-safe"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-change-title"
      >
        <div className="flex items-start justify-between border-b border-sentinel-line px-6 py-5">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sentinel-lime/25 bg-sentinel-lime/10 text-sentinel-lime">
              <KeyRound className="h-5 w-5" />
            </span>
            <div>
              <h2 id="password-change-title" className="text-lg font-semibold tracking-tight text-sentinel-text">
                {required ? "Replace temporary password" : "Change your password"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-sentinel-muted">
                {required
                  ? "Create a private password before accessing the live workspace."
                  : "Your other active sessions will be signed out immediately."}
              </p>
            </div>
          </div>
          {!required ? (
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text"
              onClick={onClose}
              aria-label="Close password dialog"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          {required ? (
            <div className="flex gap-2.5 rounded-xl border border-sentinel-amber/25 bg-sentinel-amber/10 px-3.5 py-3 text-xs leading-5 text-amber-800 dark:text-amber-100">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-amber" />
              Protected actions remain unavailable until this password is changed.
            </div>
          ) : null}
          <label className="block text-xs font-medium text-sentinel-muted">
            Current password
            <input
              className={fieldClass}
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              minLength={12}
              maxLength={256}
              autoFocus
              required
            />
          </label>
          <label className="block text-xs font-medium text-sentinel-muted">
            New password
            <input
              className={fieldClass}
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={256}
              placeholder="At least 12 characters"
              required
            />
          </label>
          <label className="block text-xs font-medium text-sentinel-muted">
            Confirm new password
            <input
              className={fieldClass}
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="new-password"
              minLength={12}
              maxLength={256}
              required
            />
          </label>
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 px-3.5 py-3 text-xs text-red-700 dark:text-red-200">
              <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
            </div>
          ) : (
            <div className="flex items-start gap-2 text-[11px] leading-5 text-sentinel-dim">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sentinel-lime" />
              Passwords are salted and hashed with scrypt. SentinelOps never stores the plaintext value.
            </div>
          )}
          <div className="flex justify-end gap-3 border-t border-sentinel-line pt-5">
            {!required ? (
              <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            ) : null}
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
              {loading ? "Changing…" : "Change password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
