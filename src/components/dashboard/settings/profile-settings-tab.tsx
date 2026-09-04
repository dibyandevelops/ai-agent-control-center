"use client";

import { Check, Copy, KeyRound, LoaderCircle, Save, ShieldCheck, User } from "lucide-react";
import { useState } from "react";
import type { OperatorIdentity } from "@/lib/types";

export function ProfileSettingsTab({
  operator,
  onUpdateOperatorName,
  onChangePassword,
}: {
  operator: OperatorIdentity | null;
  onUpdateOperatorName: (newName: string) => void;
  onChangePassword: () => void;
}) {
  const [displayName, setDisplayName] = useState(operator?.displayName || "");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim() || displayName.trim().length < 2) {
      setErrorMessage("Display name must be at least 2 characters.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/v1/session/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update profile.");
      }

      onUpdateOperatorName(displayName.trim());
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  }

  const initials =
    displayName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "OP";

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pb-6 border-b border-sentinel-line">
          <div className="h-16 w-16 rounded-2xl bg-sentinel-surface-raised border border-sentinel-line flex items-center justify-center text-xl font-bold text-sentinel-text shadow-sm">
            {initials}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-sentinel-text">
              {operator?.displayName || "Operator Profile"}
            </h3>
            <p className="text-xs text-sentinel-muted">{operator?.email}</p>
            <div className="flex items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1 rounded-md border border-sentinel-lime/30 bg-sentinel-lime/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sentinel-lime">
                <ShieldCheck className="h-3 w-3" />
                {operator?.role || "Operator"} Role
              </span>
              <span className="text-[11px] text-sentinel-muted font-mono">
                ID: {operator?.id.slice(0, 12)}…
              </span>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSaveProfile} className="mt-6 space-y-4 max-w-xl">
          {errorMessage && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-300">
              {errorMessage}
            </div>
          )}

          {savedSuccess && (
            <div className="rounded-xl border border-sentinel-lime/30 bg-sentinel-lime/10 p-3 text-xs text-sentinel-lime flex items-center gap-2">
              <Check className="h-4 w-4" />
              Profile details updated successfully.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-sentinel-text mb-1.5">
              Display Name
            </label>
            <input
              type="text"
              className="h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-surface-raised px-3 text-xs text-sentinel-text outline-none focus:border-sentinel-lime transition"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-sentinel-text mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              className="h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-surface-raised/50 px-3 text-xs text-sentinel-muted cursor-not-allowed"
              value={operator?.email || ""}
              disabled
              title="Email address is managed by your organization directory"
            />
            <p className="mt-1 text-[11px] text-sentinel-muted">
              Email addresses are linked to your organization SSO and security credentials.
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="primary-button flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Profile Changes
            </button>
          </div>
        </form>
      </div>

      {/* Security & Authentication */}
      <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-4 sm:p-6">
        <h4 className="text-sm font-semibold text-sentinel-text">Security & Authentication</h4>
        <p className="mt-1 text-xs text-sentinel-muted leading-relaxed">
          Manage your operator login credentials and multifactor authentication.
        </p>

        <div className="mt-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-sentinel-line bg-sentinel-surface-raised/40">
            <div>
              <p className="text-xs font-semibold text-sentinel-text">Operator Password</p>
              <p className="text-[11px] text-sentinel-muted mt-0.5">
                Ensure your account uses a strong passphrase with at least 12 characters.
              </p>
            </div>
            <button
              type="button"
              onClick={onChangePassword}
              className="secondary-button flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
