"use client";

import {
  ArrowDownToLine,
  Clock3,
  ExternalLink,
  Filter,
  LoaderCircle,
  Search,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import type { AuditEvent } from "@/lib/types";
import { TablePagination } from "@/components/table-pagination";
import { MfaVerificationDialog } from "@/components/mfa-verification-dialog";
import {
  displayTime,
  EmptyState,
  parseEventTimestamp,
} from "../common/ui-helpers";

export function AuditView({
  audit,
  onOpenDetails,
  initialEventId,
}: {
  audit: AuditEvent[];
  onOpenDetails: (requestId: string) => void;
  initialEventId?: string;
}) {
  const [query, setQuery] = useState(initialEventId ?? "");
  const [scope, setScope] = useState<"all" | "security">(initialEventId ? "security" : "all");
  const [timeFilter, setTimeFilter] = useState<"all" | "today" | "7d" | "30d">("all");
  const [decisionFilter, setDecisionFilter] = useState<"all" | "Allowed" | "Approved" | "Blocked">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [verifying, setVerifying] = useState(false);
  const [testingDelivery, setTestingDelivery] = useState(false);
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [digestMfaPrompt, setDigestMfaPrompt] = useState(false);
  const [integrityError, setIntegrityError] = useState("");
  const [referenceTime] = useState(() => Date.now());
  const [integrity, setIntegrity] = useState<{
    verified: boolean;
    eventsChecked: number;
    checkpointsCount?: number;
    organizationsChecked: number;
    firstInvalidEventId: string | null;
    checkedAt: string;
  } | null>(null);

  const securityEvents = useMemo(
    () => audit.filter((event) => /^(operator\.|identity\.|api_key\.|github_app\.|slack\.)/.test(event.action)),
    [audit],
  );

  const filtered = useMemo(() => {
    const baseList = scope === "security" ? securityEvents : audit;

    return baseList.filter((event) => {
      const matchesQuery = `${event.id} ${event.agent} ${event.action} ${event.actor} ${event.result}`
        .toLowerCase()
        .includes(query.toLowerCase());
      if (!matchesQuery) return false;

      if (decisionFilter !== "all" && event.result !== decisionFilter) {
        return false;
      }

      if (timeFilter !== "all") {
        const eventTimestamp = parseEventTimestamp(event.time, referenceTime);
        if (!Number.isNaN(eventTimestamp)) {
          const diffMs = referenceTime - eventTimestamp;
          if (timeFilter === "today" && (diffMs > 24 * 60 * 60 * 1000 || diffMs < -60000)) return false;
          if (timeFilter === "7d" && (diffMs > 7 * 24 * 60 * 60 * 1000 || diffMs < -60000)) return false;
          if (timeFilter === "30d" && (diffMs > 30 * 24 * 60 * 60 * 1000 || diffMs < -60000)) return false;
        }
      }

      return true;
    });
  }, [audit, securityEvents, scope, query, decisionFilter, timeFilter, referenceTime]);

  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filtered.slice(startIndex, startIndex + pageSize);
  }, [filtered, currentPage, pageSize]);

  const mfaEvents = securityEvents.filter((event) => event.action.includes("mfa"));
  const sessionEvents = securityEvents.filter((event) => event.action.includes("session"));

  async function verifyIntegrity() {
    setVerifying(true);
    setIntegrityError("");
    try {
      const response = await fetch("/api/v1/audit/integrity", {
        cache: "no-store",
      });
      const payload = (await response.json()) as NonNullable<typeof integrity> & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Audit verification failed.");
      }
      setIntegrity(payload);
    } catch (verificationError) {
      setIntegrityError(
        verificationError instanceof Error
          ? verificationError.message
          : "Audit verification failed.",
      );
    } finally {
      setVerifying(false);
    }
  }

  async function testSecurityDigestDelivery() {
    setTestingDelivery(true);
    setDeliveryMessage("");
    try {
      const response = await fetch("/api/v1/security-digest/test", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        email?: { delivered: boolean; reason: string };
        slack?: { delivered: boolean; reason: string };
      };
      if (!response.ok) throw new Error(payload.error || "Security digest test failed.");
      setDeliveryMessage(
        `Test sent — email: ${payload.email?.reason ?? "not configured"}; Slack: ${payload.slack?.reason ?? "not configured"}.`,
      );
    } catch (value) {
      const message = value instanceof Error ? value.message : "Security digest test failed.";
      if (message.includes("Recent MFA verification")) {
        setDigestMfaPrompt(true);
        return;
      }
      setDeliveryMessage(message);
    } finally {
      setTestingDelivery(false);
    }
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h2>{scope === "security" ? "Security activity" : "Audit log"}</h2>
          <p>
            {scope === "security"
              ? "Identity, MFA, session, and credential-security evidence across your organization."
              : "An immutable record of agent actions, policy decisions, and human approvals."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <button
            className="primary-button justify-center"
            onClick={verifyIntegrity}
            disabled={verifying}
          >
            {verifying ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
            {verifying ? "Verifying…" : "Verify integrity"}
          </button>
          <button
            className="secondary-button justify-center"
            onClick={() => void testSecurityDigestDelivery()}
            disabled={testingDelivery}
          >
            {testingDelivery ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
            {testingDelivery ? "Sending…" : "Test security digest"}
          </button>
          <a
            className="secondary-button justify-center"
            href={`/api/v1/audit/export?scope=${scope}`}
            download
          >
            <ArrowDownToLine /> Export CSV
          </a>
        </div>
      </div>

      {integrity ? (
        <section
          className={`mb-5 flex items-start gap-3 rounded-xl border p-4 ${
            integrity.verified
              ? "border-sentinel-lime/30 bg-sentinel-lime/10"
              : "border-red-400/30 bg-red-400/10"
          }`}
        >
          {integrity.verified ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sentinel-lime" />
          ) : (
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-300" />
          )}
          <div>
            <strong className="text-sm text-sentinel-text">
              {integrity.verified
                ? "Audit chain integrity verified"
                : "Audit chain verification failed"}
            </strong>
            <p className="mt-1 text-xs text-sentinel-muted">
              Checked {integrity.eventsChecked.toLocaleString()} events across{" "}
              {integrity.organizationsChecked.toLocaleString()} organization
              {integrity.organizationsChecked === 1 ? "" : "s"} at{" "}
              {new Date(integrity.checkedAt).toLocaleString()}.
              {integrity.checkpointsCount
                ? ` Anchored by ${integrity.checkpointsCount} historical archival checkpoint${
                    integrity.checkpointsCount === 1 ? "" : "s"
                  }.`
                : ""}
              {integrity.firstInvalidEventId
                ? ` First invalid event: ${integrity.firstInvalidEventId}.`
                : " Every event hash and previous-hash link is intact."}
            </p>
          </div>
        </section>
      ) : integrityError ? (
        <section className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-700 dark:text-red-200">
          {integrityError}
        </section>
      ) : null}

      {deliveryMessage ? (
        <section className="mb-5 rounded-xl border border-sentinel-line bg-sentinel-surface px-4 py-3 text-sm text-sentinel-muted">
          {deliveryMessage}
        </section>
      ) : null}

      {digestMfaPrompt ? (
        <MfaVerificationDialog
          actionLabel="send this security digest test"
          onClose={() => setDigestMfaPrompt(false)}
          onVerified={testSecurityDigestDelivery}
        />
      ) : null}

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted">
            Security events
          </p>
          <p className="mt-2 text-2xl font-semibold text-sentinel-text">{securityEvents.length}</p>
          <p className="mt-1 text-xs text-sentinel-muted">Last 100 audit records</p>
        </div>
        <div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted">
            MFA evidence
          </p>
          <p className="mt-2 text-2xl font-semibold text-sentinel-lime">{mfaEvents.length}</p>
          <p className="mt-1 text-xs text-sentinel-muted">Enrollments and verifications</p>
        </div>
        <div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted">
            Session events
          </p>
          <p className="mt-2 text-2xl font-semibold text-sentinel-text">{sessionEvents.length}</p>
          <p className="mt-1 text-xs text-sentinel-muted">Login, expiry, and session control</p>
        </div>
      </section>

      <section className="panel table-panel audit-table">
        <div className="section-heading table-heading">
          <label className="search-field wide-search">
            <Search />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search actions, agents, or actors…"
            />
          </label>
          <div className="table-controls flex items-center gap-2 flex-wrap">
            <label className="select-field secondary-button flex items-center gap-1.5 cursor-pointer">
              <Clock3 className="h-3.5 w-3.5 text-sentinel-muted shrink-0" />
              <select
                className="bg-transparent text-xs text-sentinel-text outline-none cursor-pointer pr-1 font-medium"
                value={timeFilter}
                onChange={(e) => {
                  setTimeFilter(e.target.value as "all" | "today" | "7d" | "30d");
                  setCurrentPage(1);
                }}
                aria-label="Filter audit events by time range"
              >
                <option value="all">All time</option>
                <option value="today">Today / 24h</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </label>

            <label className="select-field secondary-button flex items-center gap-1.5 cursor-pointer">
              <Filter className="h-3.5 w-3.5 text-sentinel-muted shrink-0" />
              <select
                className="bg-transparent text-xs text-sentinel-text outline-none cursor-pointer pr-1 font-medium"
                value={decisionFilter}
                onChange={(e) => {
                  setDecisionFilter(e.target.value as "all" | "Allowed" | "Approved" | "Blocked");
                  setCurrentPage(1);
                }}
                aria-label="Filter audit events by decision"
              >
                <option value="all">All decisions</option>
                <option value="Allowed">Allowed</option>
                <option value="Approved">Approved</option>
                <option value="Blocked">Blocked</option>
              </select>
            </label>

            <button
              className={`secondary-button ${
                scope === "security"
                  ? "border-sentinel-lime/40 text-sentinel-lime bg-sentinel-lime/10"
                  : ""
              }`}
              onClick={() => {
                setScope((current) => (current === "all" ? "security" : "all"));
                setCurrentPage(1);
              }}
              title="Toggle between all events and security-specific events"
            >
              <Filter className="h-3.5 w-3.5" />
              {scope === "security" ? "Security activity" : "All activity"}
            </button>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Agent</th>
                <th>Action</th>
                <th>Decision</th>
                <th>Actor</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEvents.map((event) => (
                <tr key={event.id}>
                  <td className="mono">{displayTime(event.time)}</td>
                  <td>
                    <strong className="plain-strong">{event.agent}</strong>
                  </td>
                  <td>{event.action}</td>
                  <td>
                    <span className={`decision decision-${event.result.toLowerCase()}`}>
                      {event.result}
                    </span>
                  </td>
                  <td>{event.actor}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      {event.requestId ? (
                        <button
                          className="text-button"
                          onClick={() => onOpenDetails(event.requestId!)}
                        >
                          View details
                        </button>
                      ) : null}
                      {event.externalReference?.startsWith("https://github.com/") ? (
                        <a
                          className="text-button"
                          href={event.externalReference}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Open external GitHub evidence"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> GitHub
                        </a>
                      ) : event.externalReference?.startsWith("dry-run://") ? (
                        <span
                          className="font-mono text-[10px] text-sentinel-muted"
                          title={event.externalReference}
                        >
                          Dry-run evidence
                        </span>
                      ) : event.requestId ? null : (
                        <span className="text-sentinel-muted">Recorded</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <EmptyState
            icon={Search}
            title="No audit events found"
            description="Try adjusting your search query, time range, or decision filters."
          />
        )}
        <TablePagination
          currentPage={currentPage}
          totalItems={filtered.length}
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="events"
        />
      </section>
    </main>
  );
}
