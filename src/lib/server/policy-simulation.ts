import type { ActionEvaluationInput } from "./contracts";
import {
  evaluatePolicies,
  policyMatches,
  type EvaluatedPolicy,
  type PolicyEffect,
} from "./policy-engine";

export interface HistoricalPolicyAction {
  requestId: string;
  agentName: string;
  requestedAt: Date;
  input: ActionEvaluationInput;
}

export interface PolicySimulationRow {
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
}

export function simulatePolicyImpact({
  candidate,
  currentPolicies,
  actions,
}: {
  candidate: EvaluatedPolicy;
  currentPolicies: EvaluatedPolicy[];
  actions: HistoricalPolicyAction[];
}) {
  const policiesWithoutCandidate = currentPolicies.filter(
    (policy) => policy.id !== candidate.id,
  );
  const rows: PolicySimulationRow[] = actions.map((action) => {
    const baseline = evaluatePolicies(action.input, currentPolicies);
    const simulated = evaluatePolicies(action.input, [
      ...policiesWithoutCandidate,
      candidate,
    ]);
    const candidateMatches = policyMatches(candidate, action.input);
    return {
      requestId: action.requestId,
      agentName: action.agentName,
      action: action.input.action,
      resource: action.input.resource,
      environment: action.input.environment,
      requestedAt: action.requestedAt.toISOString(),
      resolvedRisk: simulated.risk,
      candidateMatches,
      candidateDetermines: simulated.policyId === candidate.id,
      decisionChanged: baseline.effect !== simulated.effect,
      baselineEffect: baseline.effect,
      simulatedEffect: simulated.effect,
      winningPolicyName: simulated.policyName,
    };
  });

  return {
    actionsEvaluated: rows.length,
    matchedCount: rows.filter((row) => row.candidateMatches).length,
    determiningCount: rows.filter((row) => row.candidateDetermines).length,
    changedDecisionCount: rows.filter((row) => row.decisionChanged).length,
    rows,
  };
}
