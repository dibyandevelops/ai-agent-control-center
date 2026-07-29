import type {
  ActionEvaluationInput,
  PolicyConditions,
} from "./contracts";

export type PolicyEffect = "allow" | "approval" | "block";

export interface EvaluatedPolicy {
  id: string;
  name: string;
  effect: PolicyEffect;
  priority: number;
  conditions: PolicyConditions;
}

export interface PolicyDecision {
  effect: PolicyEffect;
  risk: "low" | "medium" | "high";
  policyId: string | null;
  policyName: string;
  reason: string;
}

const riskWeight = { low: 0, medium: 1, high: 2 } as const;

function readField(input: ActionEvaluationInput, field: string): unknown {
  if (field === "action") return input.action;
  if (field === "resource") return input.resource;
  if (field === "environment") return input.environment;
  if (field === "risk") return resolveRisk(input);
  if (field.startsWith("context.")) {
    return input.context[field.slice("context.".length)];
  }
  return undefined;
}

function matchesCondition(
  actual: unknown,
  operator: "eq" | "in" | "gte" | "contains",
  expected: unknown,
) {
  if (operator === "eq") return actual === expected;
  if (operator === "in") {
    return Array.isArray(expected) && expected.includes(actual as never);
  }
  if (operator === "gte") {
    return (
      typeof actual === "number" &&
      typeof expected === "number" &&
      actual >= expected
    );
  }
  return (
    typeof actual === "string" &&
    typeof expected === "string" &&
    actual.toLowerCase().includes(expected.toLowerCase())
  );
}

function policyMatches(
  policy: EvaluatedPolicy,
  input: ActionEvaluationInput,
) {
  return policy.conditions.all.every((condition) =>
    matchesCondition(
      readField(input, condition.field),
      condition.operator,
      condition.value,
    ),
  );
}

export function resolveRisk(
  input: ActionEvaluationInput,
): "low" | "medium" | "high" {
  let risk = input.riskHint ?? "low";
  const action = input.action.toLowerCase();
  const recordCount = input.context.recordCount;
  const amount = input.context.amount;

  if (
    input.environment === "production" ||
    action.includes("deploy") ||
    action.includes("release")
  ) {
    risk = riskWeight[risk] < riskWeight.high ? "high" : risk;
  } else if (
    (typeof recordCount === "number" && recordCount >= 1_000) ||
    (typeof amount === "number" && amount >= 10_000)
  ) {
    risk = riskWeight[risk] < riskWeight.medium ? "medium" : risk;
  }

  return risk;
}

export function evaluatePolicies(
  input: ActionEvaluationInput,
  policies: EvaluatedPolicy[],
): PolicyDecision {
  const risk = resolveRisk(input);
  const ordered = [...policies].sort((a, b) => a.priority - b.priority);
  const matched = ordered.find((policy) => policyMatches(policy, input));

  if (matched) {
    return {
      effect: matched.effect,
      risk,
      policyId: matched.id,
      policyName: matched.name,
      reason: `Matched policy: ${matched.name}`,
    };
  }

  if (risk === "high") {
    return {
      effect: "approval",
      risk,
      policyId: null,
      policyName: "High-risk safety default",
      reason: "High-risk actions require human approval by default.",
    };
  }

  return {
    effect: "allow",
    risk,
    policyId: null,
    policyName: "Least-friction safety default",
    reason: "No blocking policy matched and the resolved risk is not high.",
  };
}
