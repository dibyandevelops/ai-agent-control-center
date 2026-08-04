"use client";

import {
  Beaker,
  CheckCircle2,
  GitCompareArrows,
  LoaderCircle,
  ShieldAlert,
} from "lucide-react";
import { useState } from "react";
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

export function PolicySimulationPanel({
  draft,
}: {
  draft: PolicySimulationDraft | null;
}) {
  const [result, setResult] = useState<PolicySimulationResult | null>(null);
  const [testedFingerprint, setTestedFingerprint] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fingerprint = draft ? JSON.stringify(draft) : "";
  const stale = Boolean(result && fingerprint !== testedFingerprint);

  async function runSimulation() {
    if (!draft) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/v1/policies/simulate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, limit: 25 }),
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

  const visibleRows = result
    ? [
        ...result.rows.filter((row) => row.candidateMatches),
        ...result.rows.filter((row) => !row.candidateMatches),
      ].slice(0, 5)
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
              Test against recent actions
            </h3>
            <p className="mt-1 max-w-md text-[10px] leading-4 text-sentinel-muted">
              Replay the 25 latest actions using current policy order. Nothing is saved or enforced.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="secondary-button shrink-0"
          onClick={runSimulation}
          disabled={!draft || loading}
        >
          {loading ? <LoaderCircle className="animate-spin" /> : <Beaker />}
          {loading ? "Testing…" : result ? "Run again" : "Run simulation"}
        </button>
      </div>

      {!draft ? (
        <p className="border-t border-sentinel-line px-4 py-3 text-[10px] text-sentinel-amber">
          Complete the policy name, priority, and every condition to run a test.
        </p>
      ) : null}
      {error ? (
        <p className="border-t border-sentinel-red/30 bg-sentinel-red/10 px-4 py-3 text-xs text-red-200">
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Evaluated", result.actionsEvaluated],
              ["Matched", result.matchedCount],
              ["Draft wins", result.determiningCount],
              ["Changed", result.changedDecisionCount],
            ].map(([label, value]) => (
              <div className="rounded-lg border border-sentinel-line bg-sentinel-canvas/50 px-3 py-2" key={label}>
                <strong className="block text-sm font-semibold text-sentinel-text">{value}</strong>
                <span className="text-[9px] uppercase tracking-[0.1em] text-sentinel-dim">{label}</span>
              </div>
            ))}
          </div>

          {visibleRows.length ? (
            <div className="mt-3 divide-y divide-sentinel-line overflow-hidden rounded-lg border border-sentinel-line">
              {visibleRows.map((row) => (
                <div className="flex min-w-0 items-center gap-3 bg-sentinel-canvas/30 px-3 py-2.5" key={row.requestId}>
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${row.candidateDetermines ? "bg-sentinel-lime/10 text-sentinel-lime" : row.candidateMatches ? "bg-sentinel-amber/10 text-sentinel-amber" : "bg-sentinel-raised text-sentinel-dim"}`}>
                    {row.candidateDetermines ? <CheckCircle2 className="h-3.5 w-3.5" /> : <GitCompareArrows className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-[11px] font-medium text-sentinel-text">{row.action}</strong>
                    <span className="block truncate text-[9px] text-sentinel-muted">{row.agentName} · {row.environment} · {row.resolvedRisk} risk</span>
                  </div>
                  <div className="text-right">
                    <strong className="block text-[10px] font-semibold text-sentinel-text">{decisionLabel(row.simulatedEffect)}</strong>
                    <span className={`text-[9px] ${row.candidateDetermines ? "text-sentinel-lime" : row.candidateMatches ? "text-sentinel-amber" : "text-sentinel-dim"}`}>
                      {row.candidateDetermines ? "Draft decides" : row.candidateMatches ? "Earlier rule wins" : "No match"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[10px] text-sentinel-muted">No recent actions are available for this organization yet.</p>
          )}
        </div>
      ) : null}
    </section>
  );
}
