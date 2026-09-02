"use client";

import { KeyRound, LoaderCircle, ShieldAlert, UserPlus, X } from "lucide-react";
import React, { useState } from "react";
import type { OperatorAccount, OperatorRole } from "@/lib/types";
import { roles } from "./invite-operator-dialog";

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none transition placeholder:text-sentinel-dim focus:border-sentinel-lime/70 focus:ring-2 focus:ring-sentinel-lime/10";

export function CreateOperatorDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (operator: OperatorAccount) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OperatorRole>("approver");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/v1/operators", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, email, role, password }),
      });
      const payload = (await response.json()) as OperatorAccount & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Operator creation failed.");
      }
      onCreated(payload);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Operator creation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-app-lg border border-sentinel-line-strong bg-sentinel-surface shadow-app-2"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-operator-title"
      >
        <div className="flex items-start justify-between border-b border-sentinel-line px-6 py-5">
          <div>
            <h2
              id="create-operator-title"
              className="text-lg font-semibold tracking-tight text-sentinel-text"
            >
              Add an operator
            </h2>
            <p className="mt-1 text-xs leading-5 text-sentinel-muted">
              Assign only the access this person needs. Permissions apply immediately.
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
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-sentinel-muted">
              Full name
              <input
                className={fieldClass}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Aisha Lin"
                autoFocus
                required
                minLength={2}
                maxLength={120}
              />
            </label>
            <label className="text-xs font-medium text-sentinel-muted">
              Work email
              <input
                className={fieldClass}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="aisha@company.com"
                autoComplete="username"
                required
              />
            </label>
          </div>
          <label className="block text-xs font-medium text-sentinel-muted">
            Access role
            <select
              className={fieldClass}
              value={role}
              onChange={(event) => setRole(event.target.value as OperatorRole)}
            >
              {roles.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label} — {item.description}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-sentinel-muted">
            Temporary password
            <span className="relative block">
              <KeyRound className="pointer-events-none absolute left-3.5 top-[22px] h-4 w-4 text-sentinel-dim" />
              <input
                className={`${fieldClass} pl-10`}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 12 characters"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={256}
              />
            </span>
            <span className="mt-2 block text-[11px] font-normal leading-4 text-sentinel-dim">
              Share it through a secure channel. The operator must replace it before accessing protected workspace data.
            </span>
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
              {submitting ? <LoaderCircle className="animate-spin" /> : <UserPlus />}
              {submitting ? "Creating…" : "Create operator"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
