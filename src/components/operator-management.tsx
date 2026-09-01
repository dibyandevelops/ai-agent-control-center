"use client";

import {
  ArrowRight,
  Calendar,
  Check,
  Clock3,
  Copy,
  KeyRound,
  LoaderCircle,
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
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
import { IdentityProvisioning } from "@/components/identity-provisioning";
import { TablePagination } from "@/components/table-pagination";

interface DelegationItem {
  id: string;
  organizationId: string;
  delegatorOperatorId: string;
  delegatorEmail: string;
  delegatorDisplayName: string;
  delegateeOperatorId: string;
  delegateeEmail: string;
  delegateeDisplayName: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  createdAt: string;
  isActive: boolean;
  status: "active" | "scheduled" | "revoked" | "expired";
}

interface InvitationItem {
  id: string;
  email: string;
  role: OperatorRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
}

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
  const [operatorPage, setOperatorPage] = useState(1);
  const [operatorPageSize, setOperatorPageSize] = useState(10);
  const [invitations, setInvitations] = useState<InvitationItem[]>([]);
  const [delegations, setDelegations] = useState<DelegationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [delegationOpen, setDelegationOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<OperatorAccount | null>(null);

  const paginatedOperators = operators.slice(
    (operatorPage - 1) * operatorPageSize,
    operatorPage * operatorPageSize,
  );

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [opsRes, invRes, delRes] = await Promise.all([
          fetch("/api/v1/operators", { cache: "no-store" }),
          fetch("/api/v1/invitations", { cache: "no-store" }),
          fetch("/api/v1/approver-delegations", { cache: "no-store" }),
        ]);
        const opsPayload = (await opsRes.json()) as { operators?: OperatorAccount[]; error?: string };
        const invPayload = (await invRes.json()) as { invitations?: InvitationItem[]; error?: string };
        const delPayload = (await delRes.json()) as { delegations?: DelegationItem[]; error?: string };

        if (!opsRes.ok || !opsPayload.operators) {
          throw new Error(opsPayload.error || "Unable to load operator accounts.");
        }
        if (!cancelled) {
          setOperators(opsPayload.operators);
          if (invRes.ok && invPayload.invitations) {
            setInvitations(invPayload.invitations);
          }
          if (delRes.ok && delPayload.delegations) {
            setDelegations(delPayload.delegations);
          }
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load operator accounts.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  async function revokeDelegation(delegation: DelegationItem) {
    setBusyId(delegation.id);
    setError("");
    try {
      const response = await fetch(`/api/v1/approver-delegations/${delegation.id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to revoke delegation.");
      setDelegations((current) =>
        current.map((d) =>
          d.id === delegation.id ? { ...d, isActive: false, revokedAt: new Date().toISOString() } : d,
        ),
      );
      onNotify("Approver delegation revoked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to revoke delegation.");
    } finally {
      setBusyId(null);
    }
  }

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
      const payload = (await response.json()) as OperatorAccount & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Operator update failed.");
      }
      setOperators((current) =>
        current.map((item) => (item.id === payload.id ? payload : item)),
      );
      onNotify(`${payload.displayName}'s account was updated.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Operator update failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function resendInvite(invitationId: string) {
    setBusyId(invitationId);
    setError("");
    try {
      const response = await fetch(`/api/v1/invitations/${invitationId}/resend`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to resend invitation.");
      setInvitations((current) =>
        current.map((inv) => (inv.id === invitationId ? { ...inv, status: "pending" } : inv)),
      );
      onNotify("Invitation email resent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend invitation.");
    } finally {
      setBusyId(null);
    }
  }

  async function revokeInvite(invitationId: string) {
    setBusyId(invitationId);
    setError("");
    try {
      const response = await fetch(`/api/v1/invitations/${invitationId}/revoke`, { method: "POST" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to revoke invitation.");
      setInvitations((current) =>
        current.map((inv) => (inv.id === invitationId ? { ...inv, status: "revoked" } : inv)),
      );
      onNotify("Invitation revoked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke invitation.");
    } finally {
      setBusyId(null);
    }
  }

  async function resetOperatorPassword(operator: OperatorAccount) {
    const response = await fetch(
      `/api/v1/operators/${operator.id}/password-reset`,
      { method: "POST" },
    );
    const payload = (await response.json()) as {
      operator?: OperatorAccount;
      temporaryPassword?: string;
      error?: string;
    };
    if (!response.ok || !payload.operator || !payload.temporaryPassword) {
      throw new Error(payload.error || "Password reset failed.");
    }
    setOperators((current) =>
      current.map((item) =>
        item.id === payload.operator?.id ? payload.operator : item,
      ),
    );
    onNotify(`${payload.operator.displayName}'s sessions were revoked.`);
    return payload.temporaryPassword;
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h2>Team access</h2>
          <p>Control who can review agents, approve actions, and administer policies.</p>
        </div>
        <div className="flex gap-2">
          <button
            className="secondary-button"
            onClick={() => setInviteOpen(true)}
          >
            <Send className="h-4 w-4" /> Send invite
          </button>
          <button
            className="primary-button primary-large"
            onClick={() => setCreateOpen(true)}
          >
            <UserPlus /> Add operator
          </button>
        </div>
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
          Role checks and least-privilege permissions are enforced on every API route
        </div>
      </section>

      <IdentityProvisioning onNotify={onNotify} />

      {error ? (
        <div className="my-5 flex items-start gap-3 rounded-app border border-sentinel-red/30 bg-sentinel-red/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Invitations Section */}
      <section className="mt-6 overflow-hidden rounded-app border border-sentinel-line bg-sentinel-surface shadow-app-1">
        <div className="flex items-center justify-between border-b border-sentinel-line px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-sentinel-text">Pending & team invitations</h3>
            <p className="mt-1 text-xs text-sentinel-muted">Invite team members via email with role assignment.</p>
          </div>
          <span className="font-mono text-[11px] text-sentinel-dim">
            {invitations.length} {invitations.length === 1 ? "invitation" : "invitations"}
          </span>
        </div>

        {invitations.length === 0 ? (
          <div className="p-6 text-center text-xs text-sentinel-muted">
            No active or pending team invitations. Use &quot;Send invite&quot; to invite a member.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead className="bg-sentinel-raised/60 text-[10px] uppercase tracking-[0.12em] text-sentinel-dim">
                <tr>
                  <th className="px-5 py-3 font-medium">Invited Email</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sentinel-line text-xs">
                {invitations.map((inv) => {
                  const isBusy = busyId === inv.id;
                  return (
                    <tr key={inv.id} className="transition hover:bg-white/[0.025]">
                      <td className="px-5 py-3.5 font-medium text-sentinel-text">{inv.email}</td>
                      <td className="px-4 py-3.5 text-sentinel-muted">{roleLabel(inv.role)}</td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            inv.status === "accepted"
                              ? "bg-sentinel-lime/10 text-sentinel-lime"
                              : inv.status === "pending"
                              ? "bg-sentinel-cyan/10 text-sentinel-cyan"
                              : inv.status === "expired"
                              ? "bg-sentinel-amber/10 text-sentinel-amber"
                              : "bg-sentinel-dim/20 text-sentinel-dim"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-sentinel-muted">{formatDate(inv.expiresAt)}</td>
                      <td className="px-5 py-3.5 text-right">
                        {inv.status === "pending" || inv.status === "expired" ? (
                          <div className="flex justify-end gap-2">
                            <button
                              className="secondary-button text-xs"
                              disabled={isBusy}
                              onClick={() => void resendInvite(inv.id)}
                              title="Resend invitation email"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? "animate-spin" : ""}`} /> Resend
                            </button>
                            <button
                              className="secondary-button text-xs text-sentinel-red"
                              disabled={isBusy}
                              onClick={() => void revokeInvite(inv.id)}
                              title="Revoke invitation"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Revoke
                            </button>
                          </div>
                        ) : (
                          <span className="text-sentinel-dim">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Operator Accounts Section */}
      <section className="mt-6 overflow-hidden rounded-app border border-sentinel-line bg-sentinel-surface shadow-app-1">
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
          <div className="overflow-x-auto">
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
                {paginatedOperators.map((operator) => {
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
                                <span className="rounded-full border border-sentinel-lime/30 bg-sentinel-lime/10 px-2 py-0.5 text-[10px] font-medium text-sentinel-lime">You</span>
                              ) : null}
                            </div>
                            <span className="flex items-center gap-1.5 text-xs text-sentinel-muted">
                              <Mail className="h-3 w-3" /> {operator.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {isCurrent ? (
                          <span className="inline-flex rounded-md border border-sentinel-line bg-sentinel-canvas px-2.5 py-1 text-xs font-medium text-sentinel-text">
                            {roleLabel(operator.role)}
                          </span>
                        ) : (
                          <select
                            className="rounded-lg border border-sentinel-line bg-sentinel-canvas px-2.5 py-1 text-xs text-sentinel-text outline-none focus:border-sentinel-lime"
                            value={operator.role}
                            disabled={isBusy}
                            onChange={(e) => void updateOperator(operator, { role: e.target.value as OperatorRole })}
                          >
                            {roles.map((r) => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            operator.status === "active" && !isLocked
                              ? "bg-sentinel-lime/10 text-sentinel-lime"
                              : isLocked
                              ? "bg-sentinel-amber/10 text-sentinel-amber"
                              : "bg-sentinel-red/10 text-sentinel-red"
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {isLocked ? "Locked" : operator.status === "active" ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-sentinel-muted">
                        <span className="flex items-center gap-1.5">
                          <Clock3 className="h-3 w-3 text-sentinel-dim" /> {formatDate(operator.lastLoginAt)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="secondary-button text-xs"
                            disabled={isBusy || isCurrent}
                            onClick={() => setResetTarget(operator)}
                            title="Reset password"
                          >
                            <KeyRound className="h-3.5 w-3.5" /> Reset
                          </button>
                          {!isCurrent ? (
                            <button
                              className="secondary-button text-xs"
                              disabled={isBusy}
                              onClick={() => void updateOperator(operator, { status: operator.status === "active" ? "disabled" : "active" })}
                            >
                              {operator.status === "active" ? "Disable" : "Enable"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {operators.length > 0 && (
          <TablePagination
            currentPage={operatorPage}
            totalItems={operators.length}
            pageSize={operatorPageSize}
            onPageChange={setOperatorPage}
            onPageSizeChange={setOperatorPageSize}
            itemLabel="operators"
          />
        )}
      </section>

      {/* Approver Delegation Section */}
      <section className="mt-6 overflow-hidden rounded-app border border-sentinel-line bg-sentinel-surface shadow-app-1">
        <div className="flex items-center justify-between border-b border-sentinel-line px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-sentinel-text">
              <UserCheck className="h-4 w-4 text-sentinel-lime" />
              Approver Delegation & Out-of-Office (OOO)
            </h3>
            <p className="mt-1 text-xs text-sentinel-muted">
              Temporarily delegate your sign-off authority to another authorized operator during planned leave or travel. Transitive 4-eyes integrity is preserved.
            </p>
          </div>
          <button
            className="secondary-button"
            onClick={() => setDelegationOpen(true)}
          >
            <Calendar className="h-4 w-4" /> New delegation
          </button>
        </div>

        {delegations.length === 0 ? (
          <div className="p-8 text-center text-xs text-sentinel-muted">
            No active or historical approver delegations.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-sentinel-line bg-sentinel-canvas/50 text-[11px] font-semibold text-sentinel-muted">
                  <th className="px-5 py-3">Delegator</th>
                  <th className="px-5 py-3">Delegatee</th>
                  <th className="px-5 py-3">Reason</th>
                  <th className="px-5 py-3">Effective window</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sentinel-line">
                {delegations.map((d) => {
                  const isBusy = busyId === d.id;
                  const statusLabel =
                    d.status === "active"
                      ? "Active"
                      : d.status === "scheduled"
                        ? "Scheduled"
                        : d.status === "revoked"
                          ? "Revoked"
                          : "Expired";

                  const badgeClass =
                    statusLabel === "Active"
                      ? "bg-sentinel-lime/10 text-sentinel-lime border-sentinel-lime/30"
                      : statusLabel === "Scheduled"
                        ? "bg-sentinel-cyan/10 text-sentinel-cyan border-sentinel-cyan/30"
                        : "bg-sentinel-canvas text-sentinel-muted border-sentinel-line";

                  return (
                    <tr key={d.id} className="hover:bg-sentinel-canvas/30">
                      <td className="px-5 py-3.5 font-medium text-sentinel-text">
                        {d.delegatorDisplayName} <span className="text-sentinel-muted font-normal">({d.delegatorEmail})</span>
                      </td>
                      <td className="px-5 py-3.5 text-sentinel-text">
                        <span className="flex items-center gap-1.5">
                          <ArrowRight className="h-3 w-3 text-sentinel-muted" />
                          {d.delegateeDisplayName} <span className="text-sentinel-muted font-normal">({d.delegateeEmail})</span>
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sentinel-muted max-w-xs truncate" title={d.reason}>
                        {d.reason}
                      </td>
                      <td className="px-5 py-3.5 text-sentinel-muted">
                        {formatDate(d.startsAt)} → {formatDate(d.endsAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${badgeClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {d.isActive || (statusLabel === "Scheduled" && !d.revokedAt) ? (
                          <button
                            className="secondary-button text-xs text-sentinel-red"
                            disabled={isBusy}
                            onClick={() => void revokeDelegation(d)}
                            title="Revoke delegation"
                          >
                            {isBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Revoke
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {createOpen ? (
        <CreateOperatorDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(newOp) => {
            setOperators((cur) => [...cur, newOp]);
            setCreateOpen(false);
            onNotify(`Operator ${newOp.displayName} created.`);
          }}
        />
      ) : null}

      {inviteOpen ? (
        <InviteOperatorDialog
          onClose={() => setInviteOpen(false)}
          onInvited={(newInv) => {
            setInvitations((cur) => [newInv, ...cur]);
            setInviteOpen(false);
            onNotify(`Invitation sent to ${newInv.email}.`);
          }}
        />
      ) : null}

      {delegationOpen ? (
        <CreateDelegationDialog
          operators={operators.filter((op) => op.status === "active" && (op.role === "admin" || op.role === "approver") && op.id !== currentOperator.id)}
          onClose={() => setDelegationOpen(false)}
          onCreated={(newDel) => {
            setDelegations((cur) => [newDel, ...cur]);
            setDelegationOpen(false);
            onNotify(`Delegated approval authority to ${newDel.delegateeDisplayName}.`);
          }}
        />
      ) : null}

      {resetTarget ? (
        <ResetPasswordDialog
          operator={resetTarget}
          onClose={() => setResetTarget(null)}
          onReset={() => resetOperatorPassword(resetTarget)}
        />
      ) : null}
    </main>
  );
}

function CreateDelegationDialog({
  operators,
  onClose,
  onCreated,
}: {
  operators: OperatorAccount[];
  onClose: () => void;
  onCreated: (delegation: DelegationItem) => void;
}) {
  const [delegateeId, setDelegateeId] = useState(operators[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function applyPreset(days: number) {
    const now = new Date();
    setStartsAt(now.toISOString().slice(0, 16));
    setEndsAt(new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/v1/approver-delegations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          delegateeOperatorId: delegateeId,
          reason,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        }),
      });
      const payload = (await response.json()) as DelegationItem & { error?: string };
      if (!response.ok || payload.error) {
        throw new Error(payload.error || "Failed to create delegation.");
      }
      onCreated(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create delegation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-app-lg border border-sentinel-line-strong bg-sentinel-surface shadow-app-2" role="dialog" aria-modal="true" aria-labelledby="delegation-dialog-title">
        <div className="flex items-start justify-between border-b border-sentinel-line px-6 py-5">
          <div>
            <h2 id="delegation-dialog-title" className="text-lg font-semibold tracking-tight text-sentinel-text">Delegate sign-off authority</h2>
            <p className="mt-1 text-xs leading-5 text-sentinel-muted">Assign an eligible approver to sign off on consequential AI-agent actions during your absence.</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          <label className="block text-xs font-medium text-sentinel-muted">
            Designated delegatee
            <select
              className={fieldClass}
              value={delegateeId}
              onChange={(e) => setDelegateeId(e.target.value)}
              required
            >
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.displayName} ({op.email}) — {op.role}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-medium text-sentinel-muted">
            Delegation reason
            <input
              className={fieldClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Out of office / Annual leave"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-sentinel-muted">
              Start time
              <input
                className={fieldClass}
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </label>
            <label className="block text-xs font-medium text-sentinel-muted">
              End time
              <input
                className={fieldClass}
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
              />
            </label>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-sentinel-muted">Quick presets:</span>
            <button type="button" className="secondary-button text-[11px] py-1 px-2" onClick={() => applyPreset(3)}>3 days</button>
            <button type="button" className="secondary-button text-[11px] py-1 px-2" onClick={() => applyPreset(7)}>7 days</button>
            <button type="button" className="secondary-button text-[11px] py-1 px-2" onClick={() => applyPreset(14)}>14 days</button>
          </div>

          {error ? (
            <div className="rounded-lg border border-sentinel-red/30 bg-sentinel-red/10 p-3 text-xs text-red-700 dark:text-red-200">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-sentinel-line pt-4">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={submitting || !reason.trim() || !delegateeId}>
              {submitting ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Enable delegation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InviteOperatorDialog({
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
      const payload = (await response.json()) as { invitation?: InvitationItem; error?: string };
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
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md overflow-hidden rounded-app-lg border border-sentinel-line-strong bg-sentinel-surface shadow-app-2" role="dialog" aria-modal="true" aria-labelledby="invite-operator-title">
        <div className="flex items-start justify-between border-b border-sentinel-line px-6 py-5">
          <div>
            <h2 id="invite-operator-title" className="text-lg font-semibold tracking-tight text-sentinel-text">Invite team member</h2>
            <p className="mt-1 text-xs leading-5 text-sentinel-muted">An email invitation will be sent with role assignment.</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text" onClick={onClose} aria-label="Close dialog">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-5 px-6 py-5">
          <label className="block text-xs font-medium text-sentinel-muted">
            Work email
            <input className={fieldClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com" autoFocus required />
          </label>
          <label className="block text-xs font-medium text-sentinel-muted">
            Role
            <select className={fieldClass} value={role} onChange={(e) => setRole(e.target.value as OperatorRole)}>
              {roles.map((item) => (
                <option key={item.value} value={item.value}>{item.label} — {item.description}</option>
              ))}
            </select>
          </label>
          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 px-3.5 py-3 text-xs text-red-700 dark:text-red-200">
              <ShieldAlert className="h-4 w-4 shrink-0" /> {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-3 border-t border-sentinel-line pt-5">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
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
            <div className="flex items-start gap-2 rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 px-3.5 py-3 text-xs text-red-700 dark:text-red-200">
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

function ResetPasswordDialog({
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
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="presentation">
      <div className="w-full max-w-md overflow-hidden rounded-app-lg border border-sentinel-line-strong bg-sentinel-surface shadow-app-2" role="dialog" aria-modal="true" aria-labelledby="password-reset-title">
        <div className="flex items-start justify-between border-b border-sentinel-line px-6 py-5">
          <div className="flex gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sentinel-amber/25 bg-sentinel-amber/10 text-sentinel-amber"><KeyRound className="h-5 w-5" /></span>
            <div>
              <h2 id="password-reset-title" className="text-lg font-semibold tracking-tight text-sentinel-text">Reset operator password</h2>
              <p className="mt-1 text-xs leading-5 text-sentinel-muted">{operator.displayName} · {operator.email}</p>
            </div>
          </div>
          <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text" onClick={onClose} aria-label="Close password reset dialog"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-5 px-6 py-5">
          {temporaryPassword ? (
            <>
              <div className="flex items-start gap-2.5 rounded-xl border border-sentinel-lime/25 bg-sentinel-lime/10 px-3.5 py-3 text-xs leading-5 text-sentinel-text">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-lime" />
                Reset complete. Every previous session is revoked and this credential must be replaced at the next login.
              </div>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sentinel-dim">Temporary password · shown once</span>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-sentinel-line-strong bg-sentinel-canvas p-2">
                  <code className="min-w-0 flex-1 overflow-x-auto px-2 font-mono text-xs text-sentinel-text">{temporaryPassword}</code>
                  <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text" onClick={() => void copyPassword()} aria-label={copied ? "Temporary password copied" : "Copy temporary password"}>
                    {copied ? <Check className="h-4 w-4 text-sentinel-lime" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-sentinel-muted">SentinelOps will generate a high-entropy temporary password. Resetting immediately signs this operator out everywhere and clears any login lock.</p>
              <div className="flex items-start gap-2.5 rounded-xl border border-sentinel-amber/25 bg-sentinel-amber/10 px-3.5 py-3 text-xs leading-5 text-amber-800 dark:text-amber-100">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-amber" />
                Verify the operator&apos;s identity before sharing the credential through a secure channel.
              </div>
            </>
          )}
          {error ? <div className="rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 px-3.5 py-3 text-xs text-red-700 dark:text-red-200">{error}</div> : null}
          <div className="flex justify-end gap-3 border-t border-sentinel-line pt-5">
            {temporaryPassword ? (
              <button className="primary-button" onClick={onClose}>Done</button>
            ) : (
              <>
                <button className="secondary-button" onClick={onClose}>Cancel</button>
                <button className="primary-button" onClick={() => void reset()} disabled={loading}>
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
