"use client";

import { PlugZap, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { BrandMark } from "../navigation/sidebar";

export function LiveConnectionDialog({
  open,
  loading,
  error,
  onClose,
  onConnect,
  onSso,
}: {
  open: boolean;
  loading: boolean;
  error: string;
  onClose: () => void;
  onConnect: (email: string, password: string) => Promise<void>;
  onSso: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("admin@sentinelops.local");
  const [password, setPassword] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState("");

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (forgotMode) {
      setForgotBusy(true);
      setForgotError("");
      try {
        const response = await fetch("/api/v1/session/forgot-password", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(payload.error || "Failed to send reset link.");
        setForgotSent(true);
      } catch (err) {
        setForgotError(err instanceof Error ? err.message : "Failed to send reset link.");
      } finally {
        setForgotBusy(false);
      }
      return;
    }
    await onConnect(email, password);
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-live-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="dialog-header">
          <div className="dialog-title">
            <BrandMark small />
            <div>
              <h2 id="connect-live-title">{forgotMode ? "Reset your password" : "Sign in to SentinelOps"}</h2>
              <p>
                {forgotMode
                  ? "Enter your operator email to receive a secure recovery link."
                  : "Use your organization operator account. The browser receives an opaque, revocable HttpOnly session."}
              </p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X />
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="operator@company.com"
              autoComplete="username"
              autoFocus
              required
            />
          </label>
          {!forgotMode ? (
            <label>
              <div className="flex items-center justify-between">
                <span>Password</span>
                <button
                  type="button"
                  className="text-xs font-medium text-sentinel-lime hover:underline"
                  onClick={() => {
                    setForgotMode(true);
                    setForgotSent(false);
                    setForgotError("");
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 12 characters"
                autoComplete="current-password"
                minLength={12}
                required
              />
            </label>
          ) : null}
          {forgotSent ? (
            <div className="security-note">
              <ShieldCheck />
              <div>
                <strong>Recovery link sent</strong>
                <span>If an active operator account exists for {email}, a recovery link has been delivered.</span>
              </div>
            </div>
          ) : null}
          {forgotError || error ? (
            <div className="security-note !border-sentinel-red/40 !bg-sentinel-red/10">
              <ShieldAlert />
              <div>
                <strong>{forgotMode ? "Request failed" : "Connection failed"}</strong>
                <span>{forgotError || error}</span>
              </div>
            </div>
          ) : !forgotMode ? (
            <div className="security-note">
              <ShieldCheck />
              <div>
                <strong>Server-verified session</strong>
                <span>Live data is protected by a revocable, role-scoped account.</span>
              </div>
            </div>
          ) : null}
          <div className="dialog-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                if (forgotMode) {
                  setForgotMode(false);
                  setForgotSent(false);
                  setForgotError("");
                } else {
                  onClose();
                }
              }}
            >
              {forgotMode ? "Back to sign in" : "Cancel"}
            </button>
            <button className="primary-button" type="submit" disabled={loading || forgotBusy}>
              <PlugZap /> {forgotMode ? (forgotBusy ? "Sending link…" : "Send reset link") : loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
          {!forgotMode ? (
            <button
              type="button"
              className="mt-3 w-full text-center text-sm font-semibold text-sentinel-lime transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void onSso(email)}
              disabled={loading || !email}
            >
              Sign in with your organization SSO
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
