"use client";

import {
  Clock3,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import type {
  OperatorAccount,
  OperatorIdentity,
  OperatorRole,
} from "@/lib/types";

const roles: Array<{ value: OperatorRole; label: string; description: string }> = [
  { value: "admin", label: "Admin", description: "Full platform administration" },
  { value: "approver", label: "Approver", description: "Review and decide agent actions" },
  { value: "auditor", label: "Auditor", description: "Read-only evidence access" },
];

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none transition placeholder:text-sentinel-dim focus:border-sentinel-lime/70 focus:ring-2 focus:ring-sentinel-lime/10";

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function roleLabel(role: OperatorRole) {
  return roles.find((item) => item.value === role)?.label ?? role;
}

function isAccountLocked(operator: OperatorAccount) {
  return Boolean(
    operator.lockedUntil && Date.parse(operator.lockedUntil) > Date.now(),
  );
}

export function OperatorManagement({
  currentOperator,
  onNotify,
}: {
  currentOperator: OperatorIdentity;
  onNotify: (message: string) => void;
}) {
  const [operators, setOperators] = useState<OperatorAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadOperators() {
      try {
        const response = await fetch("/api/v1/operators", { cache: "no-store" });
        const payload = (await response.json()) as {
          operators?: OperatorAccount[];
          error?: string;
        };
        if (!response.ok || !payload.operators) {
          throw new Error(payload.error || "Unable to load operator accounts.");
        }
        if (!cancelled) setOperators(payload.operators);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load operator accounts.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOperators();
    return () => {
      cancelled = true;
    };
  }, []);

  async function updateOperator(
    operator: OperatorAccount,
    update: Partial<Pick<OperatorAccount, "role" | "status">> & {
      unlock?: true;
    },
  ) {
    setBusyId(operator.id);
    setError("");
    try {
      const response = await fetch(`/api/v1/operators/${operator.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(update),
      });
      const payload = (await response.json()) as OperatorAccount & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Operator update failed.");
      }
      setOperators((current) =>
        current.map((item) => (item.id === payload.id ? payload : item)),
      );
      onNotify(`${payload.displayName}'s account was updated.`);
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Operator update failed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h2>Team access</h2>
          <p>Control who can review agents, approve actions, and administer policies.</p>
        </div>
        <button
          className="primary-button primary-large"
          onClick={() => setCreateOpen(true)}
        >
          <UserPlus /> Add operator
        </button>
      </div>

      <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-app border border-sentinel-line bg-sentinel-surface px-5 py-4 shadow-app-1">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-sentinel-lime/20 bg-sentinel-lime/10 text-sentinel-lime">
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <strong className="block text-sm font-semibold text-sentinel-text">
              {operators.filter((operator) => operator.status === "active" && !isAccountLocked(operator)).length} active operators
            </strong>
            <span className="mt-0.5 block text-xs text-sentinel-muted">
              Access is scoped to {currentOperator.organizationName}.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-sentinel-muted">
          <ShieldCheck className="h-4 w-4 text-sentinel-lime" />
          Role checks are enforced on every protected API request
        </div>
      </section>

      {error ? (
        <div className="mb-5 flex items-start gap-3 rounded-app border border-sentinel-red/30 bg-sentinel-red/10 px-4 py-3 text-sm text-red-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-app border border-sentinel-line bg-sentinel-surface shadow-app-1">
        <div className="flex items-center justify-between border-b border-sentinel-line px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-sentinel-text">Operator accounts</h3>
            <p className="mt-1 text-xs text-sentinel-muted">Create least-privilege access and disable it immediately when no longer needed.</p>
          </div>
          <span className="font-mono text-[11px] text-sentinel-dim">
            {operators.length} {operators.length === 1 ? "account" : "accounts"}
          </span>
        </div>

        {loading ? (
          <div className="grid min-h-48 place-items-center text-sm text-sentinel-muted">
            <span className="flex items-center gap-2">
              <LoaderCircle className="h-4 w-4 animate-spin" /> Loading team access…
            </span>
          </div>
        ) : operators.length === 0 ? (
          <div className="grid min-h-48 place-items-center px-6 text-center">
            <div>
              <UsersRound className="mx-auto h-7 w-7 text-sentinel-dim" />
              <strong className="mt-3 block text-sm text-sentinel-text">No operators found</strong>
              <p className="mt-1 text-xs text-sentinel-muted">Create the first account for this organization.</p>
            </div>
          </div>
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead className="bg-sentinel-raised/60 text-[10px] uppercase tracking-[0.12em] text-sentinel-dim">
                <tr>
                  <th className="px-5 py-3 font-medium">Operator</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last sign-in</th>
                  <th className="px-5 py-3 text-right font-medium">Account control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sentinel-line">
                {operators.map((operator) => {
                  const isCurrent = operator.id === currentOperator.id;
                  const isBusy = busyId === operator.id;
                  const isLocked = isAccountLocked(operator);
                  return (
                    <tr key={operator.id} className="transition hover:bg-white/[0.025]">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-sentinel-line-strong bg-sentinel-raised text-xs font-semibold text-sentinel-text">
                            {operator.displayName
                              .split(" ")
                              .map((part) => part[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-sm font-medium text-sentinel-text">{operator.displayName}</strong>
                              {isCurrent ? (
                                <span className="rounded-md bg-sentinel-lime/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sentinel-lime">You</span>
                              ) : null}
                              {operator.mustChangePassword ? (
                                <span className="rounded-md bg-sentinel-amber/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sentinel-amber">Password update required</span>
                              ) : null}
                            </div>
                            <span className="mt-1 flex items-center gap-1.5 text-xs text-sentinel-muted">
                              <Mail className="h-3 w-3" /> {operator.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {isCurrent ? (
                          <span className="text-sm capitalize text-sentinel-text">{roleLabel(operator.role)}</span>
                        ) : (
                          <select
                            className="h-9 rounded-lg border border-sentinel-line bg-sentinel-canvas px-2.5 text-xs text-sentinel-text outline-none focus:border-sentinel-lime/60"
                            value={operator.role}
                            disabled={isBusy}
                            aria-label={`Role for ${operator.displayName}`}
                            onChange={(event) =>
                              void updateOperator(operator, {
                                role: event.target.value as OperatorRole,
                              })
                            }
                          >
                            {roles.map((role) => (
                              <option key={role.value} value={role.value}>{role.label}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-2 text-xs font-medium ${isLocked ? "text-sentinel-amber" : operator.status === "active" ? "text-sentinel-lime" : "text-sentinel-muted"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${isLocked ? "bg-sentinel-amber" : operator.status === "active" ? "bg-sentinel-lime" : "bg-sentinel-dim"}`} />
                          {isLocked ? "Temporarily locked" : operator.status === "active" ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-sentinel-muted">
                        <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {formatDate(operator.lastLoginAt)}</span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {isCurrent ? (
                          <span className="text-xs text-sentinel-dim">Protected current session</span>
                        ) : isLocked ? (
                          <button
                            className="min-w-24 rounded-lg border border-sentinel-amber/30 px-3 py-2 text-xs font-semibold text-sentinel-amber transition hover:bg-sentinel-amber/10 disabled:cursor-wait"
                            disabled={isBusy}
                            onClick={() => void updateOperator(operator, { unlock: true })}
                          >
                            {isBusy ? "Unlocking…" : "Unlock"}
                          </button>
                        ) : (
                          <button
                            className={`min-w-24 rounded-lg border px-3 py-2 text-xs font-semibold transition disabled:cursor-wait ${operator.status === "active" ? "border-sentinel-red/30 text-red-300 hover:bg-sentinel-red/10" : "border-sentinel-lime/30 text-sentinel-lime hover:bg-sentinel-lime/10"}`}
                            disabled={isBusy}
                            onClick={() =>
                              void updateOperator(operator, {
                                status: operator.status === "active" ? "disabled" : "active",
                              })
                            }
                          >
                            {isBusy ? "Updating…" : operator.status === "active" ? "Disable" : "Reactivate"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-sentinel-line md:hidden">
            {operators.map((operator) => {
              const isCurrent = operator.id === currentOperator.id;
              const isBusy = busyId === operator.id;
              const isLocked = isAccountLocked(operator);
              return (
                <article key={operator.id} className="space-y-4 px-5 py-5">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-sentinel-line-strong bg-sentinel-raised text-xs font-semibold text-sentinel-text">
                      {operator.displayName
                        .split(" ")
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <strong className="truncate text-sm font-medium text-sentinel-text">{operator.displayName}</strong>
                        {isCurrent ? (
                          <span className="rounded-md bg-sentinel-lime/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sentinel-lime">You</span>
                        ) : null}
                        {operator.mustChangePassword ? (
                          <span className="rounded-md bg-sentinel-amber/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sentinel-amber">Password update required</span>
                        ) : null}
                      </div>
                      <span className="mt-1 flex items-center gap-1.5 truncate text-xs text-sentinel-muted">
                        <Mail className="h-3 w-3 shrink-0" /> {operator.email}
                      </span>
                    </div>
                    <span className={`mt-1 inline-flex items-center gap-1.5 text-[11px] font-medium ${isLocked ? "text-sentinel-amber" : operator.status === "active" ? "text-sentinel-lime" : "text-sentinel-muted"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isLocked ? "bg-sentinel-amber" : operator.status === "active" ? "bg-sentinel-lime" : "bg-sentinel-dim"}`} />
                      {isLocked ? "Locked" : operator.status === "active" ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[10px] uppercase tracking-[0.12em] text-sentinel-dim">Role</span>
                      {isCurrent ? (
                        <span className="mt-2 block text-sm text-sentinel-text">{roleLabel(operator.role)}</span>
                      ) : (
                        <select
                          className="mt-1.5 h-9 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-2.5 text-xs text-sentinel-text outline-none focus:border-sentinel-lime/60"
                          value={operator.role}
                          disabled={isBusy}
                          aria-label={`Mobile role for ${operator.displayName}`}
                          onChange={(event) =>
                            void updateOperator(operator, {
                              role: event.target.value as OperatorRole,
                            })
                          }
                        >
                          {roles.map((role) => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase tracking-[0.12em] text-sentinel-dim">Last sign-in</span>
                      <span className="mt-2 flex items-center gap-1.5 text-xs text-sentinel-muted"><Clock3 className="h-3.5 w-3.5 shrink-0" /> {formatDate(operator.lastLoginAt)}</span>
                    </div>
                  </div>
                  {isCurrent ? (
                    <div className="rounded-lg border border-sentinel-line bg-sentinel-raised/50 px-3 py-2 text-center text-xs text-sentinel-dim">Protected current session</div>
                  ) : isLocked ? (
                    <button
                      className="w-full rounded-lg border border-sentinel-amber/30 px-3 py-2.5 text-xs font-semibold text-sentinel-amber transition hover:bg-sentinel-amber/10 disabled:cursor-wait"
                      disabled={isBusy}
                      onClick={() => void updateOperator(operator, { unlock: true })}
                    >
                      {isBusy ? "Unlocking…" : "Unlock account"}
                    </button>
                  ) : (
                    <button
                      className={`w-full rounded-lg border px-3 py-2.5 text-xs font-semibold transition disabled:cursor-wait ${operator.status === "active" ? "border-sentinel-red/30 text-red-300 hover:bg-sentinel-red/10" : "border-sentinel-lime/30 text-sentinel-lime hover:bg-sentinel-lime/10"}`}
                      disabled={isBusy}
                      onClick={() =>
                        void updateOperator(operator, {
                          status: operator.status === "active" ? "disabled" : "active",
                        })
                      }
                    >
                      {isBusy ? "Updating…" : operator.status === "active" ? "Disable account" : "Reactivate account"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
          </>
        )}
      </section>

      {createOpen ? (
        <CreateOperatorDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(operator) => {
            setOperators((current) => [...current, operator]);
            setCreateOpen(false);
            onNotify(`${operator.displayName} was added as ${roleLabel(operator.role)}.`);
          }}
        />
      ) : null}
    </main>
  );
}

function CreateOperatorDialog({
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
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-app-lg border border-sentinel-line-strong bg-sentinel-surface shadow-app-2" role="dialog" aria-modal="true" aria-labelledby="create-operator-title">
        <div className="flex items-start justify-between border-b border-sentinel-line px-6 py-5">
          <div>
            <h2 id="create-operator-title" className="text-lg font-semibold tracking-tight text-sentinel-text">Add an operator</h2>
            <p className="mt-1 text-xs leading-5 text-sentinel-muted">Assign only the access this person needs. Permissions apply immediately.</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-5 px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-medium text-sentinel-muted">
              Full name
              <input className={fieldClass} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Aisha Lin" autoFocus required minLength={2} maxLength={120} />
            </label>
            <label className="text-xs font-medium text-sentinel-muted">
              Work email
              <input className={fieldClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="aisha@company.com" autoComplete="username" required />
            </label>
          </div>
          <label className="block text-xs font-medium text-sentinel-muted">
            Access role
            <select className={fieldClass} value={role} onChange={(event) => setRole(event.target.value as OperatorRole)}>
              {roles.map((item) => (
                <option key={item.value} value={item.value}>{item.label} — {item.description}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-sentinel-muted">
            Temporary password
            <span className="relative block">
              <KeyRound className="pointer-events-none absolute left-3.5 top-[22px] h-4 w-4 text-sentinel-dim" />
              <input className={`${fieldClass} pl-10`} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" autoComplete="new-password" required minLength={12} maxLength={256} />
            </span>
            <span className="mt-2 block text-[11px] font-normal leading-4 text-sentinel-dim">Share it through a secure channel. The operator must replace it before accessing protected workspace data.</span>
          </label>
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 px-3.5 py-3 text-xs text-red-200">
              <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-3 border-t border-sentinel-line pt-5">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
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
