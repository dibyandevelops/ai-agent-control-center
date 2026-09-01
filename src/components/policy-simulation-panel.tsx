"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  Beaker,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GitCompareArrows,
  LoaderCircle,
  Play,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { Policy } from "@/lib/types";

type PolicyEffect = "block" | "approval" | "allow";

export interface PolicySimulationDraft {
  policyId?: string;
  name: string;
  priority: number;
  effect: PolicyEffect;
  conditions: { all: NonNullable<Policy["conditions"]> };
}

interface PolicySimulationResult {
  actionsEvaluated: number;
  matchedCount: number;
  determiningCount: number;
  changedDecisionCount: number;
  simulatedAt: string;
  policyOrderBasis: string;
  syntheticResult?: {
    action: string;
    resource: string;
    environment: string;
    baselineEffect: PolicyEffect;
    simulatedEffect: PolicyEffect;
    winningPolicyName: string;
    decisionChanged: boolean;
  } | null;
  rows: Array<{
    requestId: string;
    agentName: string;
    action: string;
    resource: string;
    environment: "development" | "staging" | "production";
    requestedAt: string;
    resolvedRisk: "low" | "medium" | "high";
    candidateMatches: boolean;
    candidateDetermines: boolean;
    decisionChanged: boolean;
    baselineEffect: PolicyEffect;
    simulatedEffect: PolicyEffect;
    winningPolicyName: string;
  }>;
}

function decisionLabel(effect: PolicyEffect) {
  if (effect === "block") return "Block";
  if (effect === "approval") return "Approval";
  return "Allow";
}

function effectBadgeClass(effect: PolicyEffect) {
  if (effect === "block") return "bg-sentinel-red/15 text-red-600 dark:text-red-300 border-sentinel-red/30";
  if (effect === "approval") return "bg-sentinel-amber/15 text-sentinel-amber border-sentinel-amber/30";
  return "bg-sentinel-lime/15 text-sentinel-lime border-sentinel-lime/30";
}

export function PolicySimulationPanel({
  draft: propDraft,
  policies = [],
}: {
  draft?: PolicySimulationDraft | null;
  policies?: Policy[];
}) {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>(policies[0]?.id || "");
  const [result, setResult] = useState<PolicySimulationResult | null>(null);
  const [testedFingerprint, setTestedFingerprint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [limit, setLimit] = useState<number>(25);
  const [environment, setEnvironment] = useState<string>("all");
  const [filterChangedOnly, setFilterChangedOnly] = useState(false);

  // Synthetic ad-hoc testing state
  const [syntheticOpen, setSyntheticOpen] = useState(false);
  const [synthAction, setSynthAction] = useState("database.delete_records");
  const [synthResource, setSynthResource] = useState("production_users");
  const [synthEnv, setSynthEnv] = useState<"production" | "staging" | "development">("production");
  const [synthRisk, setSynthRisk] = useState<"low" | "medium" | "high">("high");
  const [synthRecordCount, setSynthRecordCount] = useState("100");

  const draft = useMemo<PolicySimulationDraft | null>(() => {
    if (propDraft) return propDraft;
    const selected = policies.find((p) => p.id === selectedPolicyId) || policies[0];
    if (!selected) {
      return {
        name: "Synthetic Ad-Hoc Evaluation",
        priority: 100,
        effect: "block",
        conditions: { all: [] },
      };
    }
    return {
      policyId: selected.id,
      name: selected.name,
      priority: selected.priority ?? 100,
      effect: (selected.effect || selected.mode.toLowerCase()) as PolicyEffect,
      conditions: { all: selected.conditions || [] },
    };
  }, [propDraft, policies, selectedPolicyId]);

  const fingerprint = draft ? `${JSON.stringify(draft)}-${limit}-${environment}` : "";
  const stale = Boolean(result && fingerprint !== testedFingerprint);

  async function runSimulation(includeSynthetic = false) {
    if (!draft) return;
    setLoading(true);
    setError("");
    try {
      const payloadBody: Record<string, unknown> = {
        ...draft,
        limit,
      };
      if (environment !== "all") {
        payloadBody.environment = environment;
      }
      if (includeSynthetic || syntheticOpen) {
        payloadBody.syntheticAction = {
          action: synthAction.trim(),
          resource: synthResource.trim(),
          environment: synthEnv,
          risk: synthRisk,
          context: {
            recordCount: Number(synthRecordCount) || 0,
          },
        };
      }

      const response = await fetch("/api/v1/policies/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payloadBody),
      });
      const payload = (await response.json()) as PolicySimulationResult & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Policy simulation failed.");
      }
      setResult(payload);
      setTestedFingerprint(fingerprint);
    } catch (simulationError) {
      setError(
        simulationError instanceof Error
          ? simulationError.message
          : "Policy simulation failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  function exportReport() {
    if (!result) return;
    const jsonStr = JSON.stringify(
      {
        simulatedAt: result.simulatedAt,
        policyDraft: draft,
        summary: {
          evaluated: result.actionsEvaluated,
          matched: result.matchedCount,
          determining: result.determiningCount,
          changed: result.changedDecisionCount,
        },
        syntheticResult: result.syntheticResult,
        rows: result.rows,
      },
      null,
      2,
    );
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sentinelops-policy-simulation-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const displayedRows = result
    ? result.rows.filter((r) => !filterChangedOnly || r.decisionChanged)
    : [];

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-sentinel-line bg-sentinel-raised/40">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sentinel-lime/20 bg-sentinel-lime/10 text-sentinel-lime">
            <Beaker className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-xs font-semibold text-sentinel-text">
              Policy Sandbox & Trace Replay Engine
            </h3>
            <p className="mt-1 max-w-md text-[10px] leading-4 text-sentinel-muted">
              Replay historical action traces and dry-run synthetic test cases against current enabled policies.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!propDraft && policies.length > 0 ? (
            <select
              className="h-8 rounded-lg border border-sentinel-line bg-sentinel-canvas px-2.5 text-[11px] text-sentinel-text outline-none max-w-[210px] truncate"
              value={selectedPolicyId}
              onChange={(e) => setSelectedPolicyId(e.target.value)}
              aria-label="Select target policy to simulate"
            >
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  Rule: {p.name}
                </option>
              ))}
            </select>
          ) : null}

          <select
            className="h-8 rounded-lg border border-sentinel-line bg-sentinel-canvas px-2.5 text-[11px] text-sentinel-text outline-none"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            aria-label="Trace limit"
          >
            <option value={25}>25 traces</option>
            <option value={50}>50 traces</option>
            <option value={100}>100 traces</option>
          </select>

          <select
            className="h-8 rounded-lg border border-sentinel-line bg-sentinel-canvas px-2.5 text-[11px] text-sentinel-text outline-none"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            aria-label="Filter environment"
          >
            <option value="all">All Envs</option>
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="development">Development</option>
          </select>

          <button
            type="button"
            className="primary-button text-xs py-1.5 px-3 shrink-0"
            onClick={() => void runSimulation(false)}
            disabled={!draft || loading}
          >
            {loading ? <LoaderCircle className="animate-spin h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {loading ? "Replaying…" : result ? "Re-run sandbox" : "Run simulation"}
          </button>
        </div>
      </div>

      {/* Synthetic Dry-Run Drawer Toggle */}
      <div className="border-t border-sentinel-line/60 bg-sentinel-canvas/40 px-4 py-2 flex items-center justify-between">
        <button
          type="button"
          className="flex items-center gap-1.5 text-[11px] font-medium text-sentinel-lime hover:underline"
          onClick={() => setSyntheticOpen((prev) => !prev)}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {syntheticOpen ? "Hide Synthetic Dry-Run Drawer" : "Open Synthetic Ad-Hoc Tester"}
          {syntheticOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {result ? (
          <button
            type="button"
            className="secondary-button text-[11px] py-1 px-2.5 flex items-center gap-1.5"
            onClick={exportReport}
            title="Download full JSON simulation evidence"
          >
            <ArrowDownToLine className="h-3 w-3" /> Export evidence
          </button>
        ) : null}
      </div>

      {syntheticOpen ? (
        <div className="border-t border-sentinel-line bg-sentinel-canvas/80 p-4 space-y-3">
          <span className="text-[11px] font-semibold text-sentinel-text block">
            Ad-Hoc Synthetic Action Dry-Run
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <label className="block text-[10px] text-sentinel-muted">
              Action
              <input
                className="mt-1 h-8 w-full rounded-lg border border-sentinel-line bg-sentinel-surface px-2 text-[11px] text-sentinel-text outline-none"
                value={synthAction}
                onChange={(e) => setSynthAction(e.target.value)}
                placeholder="e.g. database.delete_records"
              />
            </label>
            <label className="block text-[10px] text-sentinel-muted">
              Resource
              <input
                className="mt-1 h-8 w-full rounded-lg border border-sentinel-line bg-sentinel-surface px-2 text-[11px] text-sentinel-text outline-none"
                value={synthResource}
                onChange={(e) => setSynthResource(e.target.value)}
                placeholder="e.g. users_table"
              />
            </label>
            <label className="block text-[10px] text-sentinel-muted">
              Context recordCount
              <input
                className="mt-1 h-8 w-full rounded-lg border border-sentinel-line bg-sentinel-surface px-2 text-[11px] text-sentinel-text outline-none"
                type="number"
                value={synthRecordCount}
                onChange={(e) => setSynthRecordCount(e.target.value)}
              />
            </label>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-sentinel-muted">Env:</label>
              <select
                className="h-7 rounded border border-sentinel-line bg-sentinel-surface px-2 text-[10px] text-sentinel-text"
                value={synthEnv}
                onChange={(e) => setSynthEnv(e.target.value as "production" | "staging" | "development")}
              >
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="development">Development</option>
              </select>

              <label className="text-[10px] text-sentinel-muted ml-2">Risk:</label>
              <select
                className="h-7 rounded border border-sentinel-line bg-sentinel-surface px-2 text-[10px] text-sentinel-text"
                value={synthRisk}
                onChange={(e) => setSynthRisk(e.target.value as "low" | "medium" | "high")}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            <button
              type="button"
              className="secondary-button text-xs py-1 px-3"
              onClick={() => void runSimulation(true)}
              disabled={!draft || loading}
            >
              Test synthetic action
            </button>
          </div>

          {result?.syntheticResult ? (
            <div className="mt-2 rounded-lg border border-sentinel-lime/30 bg-sentinel-lime/10 p-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-medium text-sentinel-text block">
                  Synthetic Dry-Run Result:
                </span>
                <span className="text-[11px] text-sentinel-muted">
                  {result.syntheticResult.action} on {result.syntheticResult.resource} ({result.syntheticResult.environment})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-sentinel-muted">Baseline:</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${effectBadgeClass(result.syntheticResult.baselineEffect)}`}>
                  {decisionLabel(result.syntheticResult.baselineEffect)}
                </span>
                <ArrowRight className="h-3 w-3 text-sentinel-muted" />
                <span className="text-[11px] text-sentinel-muted">Candidate:</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${effectBadgeClass(result.syntheticResult.simulatedEffect)}`}>
                  {decisionLabel(result.syntheticResult.simulatedEffect)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {!draft ? (
        <p className="border-t border-sentinel-line px-4 py-3 text-[10px] text-sentinel-amber">
          Complete the policy name, priority, and every condition to run a test.
        </p>
      ) : null}
      {error ? (
        <p className="border-t border-sentinel-red/30 bg-sentinel-red/10 px-4 py-3 text-xs text-red-700 dark:text-red-200">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className={`border-t border-sentinel-line p-4 transition ${stale ? "opacity-55" : ""}`}>
          {stale ? (
            <div className="mb-3 flex items-center gap-2 text-[10px] font-medium text-sentinel-amber">
              <ShieldAlert className="h-3.5 w-3.5" /> Draft changed since this test. Run it again for current results.
            </div>
          ) : null}

          {/* Metrics summary */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Evaluated", result.actionsEvaluated, "text-sentinel-text"],
              ["Matched Rules", result.matchedCount, "text-sentinel-cyan"],
              ["Candidate Determines", result.determiningCount, "text-sentinel-lime"],
              ["Decisions Changed", result.changedDecisionCount, result.changedDecisionCount > 0 ? "text-sentinel-amber" : "text-sentinel-muted"],
            ].map(([label, value, colorClass]) => (
              <div className="rounded-lg border border-sentinel-line bg-sentinel-canvas/50 px-3 py-2" key={String(label)}>
                <strong className={`block text-base font-semibold ${colorClass}`}>{value}</strong>
                <span className="text-[9px] uppercase tracking-[0.1em] text-sentinel-dim">{label}</span>
              </div>
            ))}
          </div>

          {/* Table Header Filter */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-sentinel-text">
              Trace Replay Results ({displayedRows.length})
            </span>
            <label className="flex items-center gap-1.5 text-[11px] text-sentinel-muted cursor-pointer">
              <input
                type="checkbox"
                checked={filterChangedOnly}
                onChange={(e) => setFilterChangedOnly(e.target.checked)}
                className="rounded border-sentinel-line"
              />
              Show changed decisions only ({result.changedDecisionCount})
            </label>
          </div>

          {displayedRows.length ? (
            <div className="mt-2 divide-y divide-sentinel-line overflow-hidden rounded-lg border border-sentinel-line max-h-80 overflow-y-auto">
              {displayedRows.map((row) => (
                <div className="flex min-w-0 items-center justify-between gap-3 bg-sentinel-canvas/30 px-3 py-2.5 hover:bg-sentinel-canvas/60" key={row.requestId}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${row.candidateDetermines ? "bg-sentinel-lime/10 text-sentinel-lime" : row.candidateMatches ? "bg-sentinel-amber/10 text-sentinel-amber" : "bg-sentinel-raised text-sentinel-dim"}`}>
                      {row.candidateDetermines ? <CheckCircle2 className="h-3.5 w-3.5" /> : <GitCompareArrows className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-[11px] font-medium text-sentinel-text">{row.action}</strong>
                      <span className="block truncate text-[9px] text-sentinel-muted">
                        {row.agentName} · {row.resource} · {row.environment} · {row.resolvedRisk} risk
                      </span>
                    </div>
                  </div>

                  {/* Diff indicator */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1.5">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold border ${effectBadgeClass(row.baselineEffect)}`}>
                          {decisionLabel(row.baselineEffect)}
                        </span>
                        <ArrowRight className="h-3 w-3 text-sentinel-muted" />
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold border ${effectBadgeClass(row.simulatedEffect)}`}>
                          {decisionLabel(row.simulatedEffect)}
                        </span>
                      </div>
                      <span className={`text-[9px] block mt-0.5 ${row.decisionChanged ? "text-sentinel-amber font-medium" : "text-sentinel-dim"}`}>
                        {row.decisionChanged ? "Decision Changed" : "Unchanged"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[10px] text-sentinel-muted">
              {filterChangedOnly ? "No decision changes found across tested traces." : "No historical traces match the selected filters."}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
