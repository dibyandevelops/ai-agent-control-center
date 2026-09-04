"use client";

import { LoaderCircle, Send, ShieldAlert, X } from "lucide-react";
import React, { useState } from "react";
import type { OperatorRole } from "@/lib/types";

export interface InvitationItem {
  id: string;
  email: string;
  role: OperatorRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
}

export const roles: Array<{ value: OperatorRole; label: string; description: string }> = [
  { value: "admin", label: "Admin", description: "Full platform administration" },
  { value: "approver", label: "Approver", description: "Review and decide agent actions" },
  { value: "auditor", label: "Auditor", description: "Read-only evidence access" },
];

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none transition placeholder:text-sentinel-dim focus:border-sentinel-lime/70 focus:ring-2 focus:ring-sentinel-lime/10";

export function InviteOperatorDialog({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: (invitation: InvitationItem) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OperatorRole>("approver");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/v1/invitations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const payload = (await response.json()) as {
        invitation?: InvitationItem;
        error?: string;
      };
      if (!response.ok || !payload.invitation) {
        throw new Error(payload.error || "Failed to send invitation.");
      }
      onInvited(payload.invitation);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invitation.");
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
        className="w-full max-w-md overflow-hidden rounded-app-lg max-sm:rounded-b-none max-sm:max-h-[90dvh] max-sm:overflow-y-auto border border-sentinel-line-strong bg-sentinel-surface shadow-app-2 pb-safe"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-operator-title"
      >
        <div className="flex items-start justify-between border-b border-sentinel-line px-6 py-5">
          <div>
            <h2
              id="invite-operator-title"
              className="text-lg font-semibold tracking-tight text-sentinel-text"
            >
              Invite team member
            </h2>
            <p className="mt-1 text-xs leading-5 text-sentinel-muted">
              An email invitation will be sent with role assignment.
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
        <form onSubmit={submit} className="space-y-5 px-6 py-5">
          <label className="block text-xs font-medium text-sentinel-muted">
            Work email
            <input
              className={fieldClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              autoFocus
              required
            />
          </label>
          <label className="block text-xs font-medium text-sentinel-muted">
            Role
            <select
              className={fieldClass}
              value={role}
              onChange={(e) => setRole(e.target.value as OperatorRole)}
            >
              {roles.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} — {item.description}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 px-3.5 py-3 text-xs text-red-700 dark:text-red-200">
              <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-3 border-t border-sentinel-line pt-5">
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={submitting}>
              {submitting ? <LoaderCircle className="animate-spin" /> : <Send className="h-4 w-4" />}
              {submitting ? "Sending…" : "Send invitation"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
