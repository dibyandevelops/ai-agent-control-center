"use client";

import {
  Activity,
  ChevronDown,
  ClipboardCheck,
  LockKeyhole,
  Plus,
  Search,
  ShieldCheck,
  Zap,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import type { AuditEvent, Policy, PolicyActivationRequest } from "@/lib/types";
import { summarizePolicyDecisions } from "@/lib/dashboard-metrics";
import { PolicyEditorDialog } from "@/components/policy-editor-dialog";
import {
  PolicyActivationQueue,
  PolicyHistoryDialog,
} from "@/components/policy-governance";
import { PolicySimulationPanel } from "@/components/policy-simulation-panel";
import { EmptyState } from "../common/ui-helpers";

export function PoliciesView({
  policies,
  activations,
  audit,
  operatorId,
  onToggle,
  onSaved,
  onActivationDecision,
  onRefresh,
  canManage,
}: {
  policies: Policy[];
  activations: PolicyActivationRequest[];
  audit: AuditEvent[];
  operatorId: string;
  onToggle: (id: string) => void;
  onSaved: (policy: Policy) => void;
  onActivationDecision: (
    requestId: string,
    decision: "approved" | "rejected",
    reason: string,
  ) => Promise<void>;
  onRefresh: () => Promise<void>;
  canManage: boolean;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [historyPolicy, setHistoryPolicy] = useState<Policy | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "active" | "Block" | "Approval" | "pending">("all");
  const [expandedConditions, setExpandedConditions] = useState<Record<string, boolean>>({});

  const policySummary = useMemo(() => summarizePolicyDecisions(audit), [audit]);
  const compliance =
    policySummary.compliancePercent === null
      ? "—"
      : `${policySummary.compliancePercent.toFixed(1)}%`;

  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      const matchesSearch = `${policy.name} ${policy.description} ${policy.scope}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (modeFilter === "active") return policy.enabled;
      if (modeFilter === "pending") return policy.activationStatus === "pending" || policy.activationStatus === "draft";
      if (modeFilter !== "all" && policy.mode !== modeFilter) return false;
      return true;
    });
  }, [policies, searchQuery, modeFilter]);

  const decisionWidth = (count: number) =>
    policySummary.total ? `${Math.max((count / policySummary.total) * 100, count ? 8 : 0)}%` : "0%";

  function openEditor(policy: Policy | null) {
    setEditingPolicy(policy);
    setEditorOpen(true);
  }

  function toggleConditionExpand(policyId: string) {
    setExpandedConditions((prev) => ({
      ...prev,
      [policyId]: !prev[policyId],
    }));
  }

  function scrollToSandbox() {
    const el = document.getElementById("policy-sandbox");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }

  const activeCount = policies.filter((p) => p.enabled).length;
  const blockCount = policies.filter((p) => p.mode === "Block").length;
  const approvalCount = policies.filter((p) => p.mode === "Approval").length;
  const pendingCount = policies.filter((p) => p.activationStatus === "pending" || p.activationStatus === "draft").length;

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h2>Policy engine</h2>
          <p>Turn governance requirements into deterministic guardrails executed across every agent action.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="secondary-button"
            onClick={scrollToSandbox}
          >
            <Zap className="h-4 w-4 text-sentinel-accent" /> Test in Sandbox
          </button>
          <button
            className="primary-button primary-large"
            onClick={() => openEditor(null)}
            disabled={!canManage}
          >
            <Plus /> Create policy
          </button>
        </div>
      </div>

      <div className="policy-layout">
        <section className="panel policy-list">
          <div className="section-heading flex-wrap gap-3">
            <div>
              <h2>Enforcement policies</h2>
              <p>{activeCount} of {policies.length} policies actively enforced</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <label className="search-field">
                <Search />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search rules or scopes…"
                  aria-label="Search policies"
                />
              </label>
            </div>
          </div>

          {/* Filter Pills Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto px-5 py-2.5 border-b border-sentinel-border bg-sentinel-surface-raised/20 text-xs">
            <button
              type="button"
              onClick={() => setModeFilter("all")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                modeFilter === "all"
                  ? "bg-sentinel-surface text-sentinel-text border border-sentinel-border-strong shadow-xs"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              All ({policies.length})
            </button>
            <button
              type="button"
              onClick={() => setModeFilter("active")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                modeFilter === "active"
                  ? "bg-sentinel-success-soft text-sentinel-success border border-sentinel-success/30 shadow-xs"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              type="button"
              onClick={() => setModeFilter("Block")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                modeFilter === "Block"
                  ? "bg-sentinel-danger-soft text-sentinel-danger border border-sentinel-danger/30 shadow-xs"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              Block ({blockCount})
            </button>
            <button
              type="button"
              onClick={() => setModeFilter("Approval")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                modeFilter === "Approval"
                  ? "bg-sentinel-amber-soft text-sentinel-amber border border-sentinel-amber/30 shadow-xs"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              Approval ({approvalCount})
            </button>
            {pendingCount > 0 ? (
              <button
                type="button"
                onClick={() => setModeFilter("pending")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  modeFilter === "pending"
                    ? "bg-sentinel-accent-soft text-sentinel-accent border border-sentinel-accent/30 shadow-xs"
                    : "text-sentinel-muted hover:text-sentinel-text"
                }`}
              >
                Review ({pendingCount})
              </button>
            ) : null}
          </div>

          <div className="divide-y divide-sentinel-border">
            {filteredPolicies.map((policy) => {
              const isExpanded = Boolean(expandedConditions[policy.id]);
              return (
                <article className="policy-row" key={policy.id}>
                  <div className={`policy-icon policy-${policy.mode.toLowerCase()}`}>
                    {policy.mode === "Block" ? <LockKeyhole /> : policy.mode === "Approval" ? <ClipboardCheck /> : <Activity />}
                  </div>
                  <div className="policy-copy space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-sentinel-text">{policy.name}</h3>
                      <span className={`mode mode-${policy.mode.toLowerCase()}`}>{policy.mode}</span>
                      {policy.activationStatus === "pending" ? (
                        <span className="mode mode-approval">Awaiting Approval</span>
                      ) : policy.activationStatus === "draft" ? (
                        <span className="mode mode-block">Draft v{policy.latestVersionNumber}</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-sentinel-muted">{policy.description}</p>
                    <small className="font-mono text-[11px] text-sentinel-muted">
                      {policy.scope} · active v{policy.activeVersionNumber ?? 1} · {policy.matches} matches (7d)
                    </small>

                    {/* Collapsible condition inspector */}
                    {policy.conditions && policy.conditions.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => toggleConditionExpand(policy.id)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-sentinel-accent hover:underline"
                        >
                          <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          <span>{isExpanded ? "Hide rule predicates" : `Inspect rule logic (${policy.conditions.length} condition${policy.conditions.length === 1 ? "" : "s"})`}</span>
                        </button>

                        {isExpanded && (
                          <div className="mt-2 rounded-xl border border-sentinel-border bg-sentinel-canvas/80 p-3 space-y-1.5 font-mono text-[11px] animate-dialog-in">
                            <div className="text-[10px] text-sentinel-muted font-bold uppercase tracking-wider">
                              Match Predicates (ALL)
                            </div>
                            {policy.conditions.map((cond, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs flex-wrap">
                                <span className="rounded bg-sentinel-surface-raised px-1.5 py-0.5 text-sentinel-text font-semibold">
                                  {cond.field}
                                </span>
                                <span className="text-sentinel-muted">{cond.operator}</span>
                                <span className="rounded bg-sentinel-accent-soft px-1.5 py-0.5 text-sentinel-accent font-semibold">
                                  {Array.isArray(cond.value) ? cond.value.join(", ") : String(cond.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="policy-actions">
                    <button
                      type="button"
                      className="rounded-lg border border-sentinel-border px-2.5 py-1.5 text-xs font-semibold text-sentinel-muted transition hover:border-sentinel-border-strong hover:text-sentinel-text"
                      onClick={() => setHistoryPolicy(policy)}
                      title="View version audit history"
                    >
                      History
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-sentinel-border px-2.5 py-1.5 text-xs font-semibold text-sentinel-muted transition hover:border-sentinel-border-strong hover:text-sentinel-text disabled:opacity-40"
                      onClick={() => openEditor(policy)}
                      disabled={!canManage}
                    >
                      Edit
                    </button>
                    <button
                      role="switch"
                      aria-checked={policy.enabled}
                      aria-label={`${policy.enabled ? "Disable" : "Request activation for"} ${policy.name}`}
                      className={`toggle ${policy.enabled ? "toggle-on" : ""}`}
                      disabled={!canManage || policy.activationStatus === "pending"}
                      onClick={() => onToggle(policy.id)}
                    >
                      <span />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredPolicies.length === 0 && (
            <EmptyState
              icon={Search}
              title="No policies found"
              description="Try adjusting your policy search query or mode filter."
            />
          )}
        </section>
        <aside className="space-y-4">
          <PolicyActivationQueue
            requests={activations}
            operatorId={operatorId}
            onDecision={onActivationDecision}
          />
          <section className="panel policy-insight">
            <div className="insight-icon"><ShieldCheck /></div>
            <h2>{compliance}</h2>
            <strong>Policy compliance</strong>
            <p>
              {policySummary.total
                ? `Controls recorded ${policySummary.total} policy decisions in the current audit window.`
                : "No completed policy decisions have been recorded yet."}
            </p>
            <div className="insight-bars">
              <span><i style={{ width: decisionWidth(policySummary.allowed) }} />Allowed <b>{policySummary.allowed}</b></span>
              <span><i style={{ width: decisionWidth(policySummary.approved) }} />Approved <b>{policySummary.approved}</b></span>
              <span><i style={{ width: decisionWidth(policySummary.blocked) }} />Blocked <b>{policySummary.blocked}</b></span>
            </div>
          </section>
        </aside>
      </div>

      <div id="policy-sandbox" className="mt-5 scroll-mt-6">
        <PolicySimulationPanel policies={policies} />
      </div>
      {editorOpen ? (
        <PolicyEditorDialog
          policy={editingPolicy}
          onClose={() => setEditorOpen(false)}
          onSaved={(savedPolicy) => {
            onSaved(savedPolicy);
            setEditorOpen(false);
          }}
        />
      ) : null}
      {historyPolicy ? (
        <PolicyHistoryDialog
          policy={historyPolicy}
          canManage={canManage}
          onClose={() => setHistoryPolicy(null)}
          onChanged={onRefresh}
        />
      ) : null}
    </main>
  );
}
