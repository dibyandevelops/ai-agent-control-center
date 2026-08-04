import { describe, expect, it } from "vitest";
import type { ActionEvaluationInput } from "./contracts";
import type { EvaluatedPolicy } from "./policy-engine";
import { simulatePolicyImpact } from "./policy-simulation";

const baseInput: ActionEvaluationInput = {
  idempotencyKey: "historical-request-1",
  agent: {
    externalId: "release-agent",
    name: "Release Agent",
    ownerEmail: "platform@example.com",
    team: "Platform Engineering",
    provider: "OpenAI",
  },
  action: "deploy.release",
  resource: "sentinelops/platform",
  environment: "production",
  context: {},
};

const candidate: EvaluatedPolicy = {
  id: "candidate-policy",
  name: "Review production releases",
  effect: "approval",
  priority: 10,
  conditions: {
    all: [
      { field: "action", operator: "eq", value: "deploy.release" },
      { field: "environment", operator: "eq", value: "production" },
    ],
  },
};

describe("policy simulation", () => {
  it("reports when the draft matches and determines the decision", () => {
    const result = simulatePolicyImpact({
      candidate,
      currentPolicies: [],
      actions: [
        {
          requestId: "request-1",
          agentName: "Release Agent",
          requestedAt: new Date("2026-08-04T00:00:00.000Z"),
          input: baseInput,
        },
      ],
    });

    expect(result.matchedCount).toBe(1);
    expect(result.determiningCount).toBe(1);
    expect(result.rows[0]).toMatchObject({
      candidateMatches: true,
      candidateDetermines: true,
      simulatedEffect: "approval",
      winningPolicyName: candidate.name,
    });
  });

  it("distinguishes a matching draft from the higher-priority winner", () => {
    const higherPriorityBlock: EvaluatedPolicy = {
      id: "existing-block",
      name: "Block production releases",
      effect: "block",
      priority: 1,
      conditions: candidate.conditions,
    };
    const result = simulatePolicyImpact({
      candidate,
      currentPolicies: [higherPriorityBlock],
      actions: [
        {
          requestId: "request-1",
          agentName: "Release Agent",
          requestedAt: new Date("2026-08-04T00:00:00.000Z"),
          input: baseInput,
        },
      ],
    });

    expect(result.matchedCount).toBe(1);
    expect(result.determiningCount).toBe(0);
    expect(result.rows[0]).toMatchObject({
      candidateMatches: true,
      candidateDetermines: false,
      simulatedEffect: "block",
      winningPolicyName: higherPriorityBlock.name,
    });
  });

  it("shows when the draft changes a recent action's effect", () => {
    const stagingInput = {
      ...baseInput,
      action: "data.export",
      environment: "staging" as const,
    };
    const blockExport: EvaluatedPolicy = {
      ...candidate,
      effect: "block",
      conditions: {
        all: [{ field: "action", operator: "eq", value: "data.export" }],
      },
    };
    const result = simulatePolicyImpact({
      candidate: blockExport,
      currentPolicies: [],
      actions: [
        {
          requestId: "request-2",
          agentName: "Data Agent",
          requestedAt: new Date("2026-08-04T00:00:00.000Z"),
          input: stagingInput,
        },
      ],
    });

    expect(result.changedDecisionCount).toBe(1);
    expect(result.rows[0]).toMatchObject({
      baselineEffect: "allow",
      simulatedEffect: "block",
      decisionChanged: true,
    });
  });

  it("compares an edited draft with the currently active policy", () => {
    const activeVersion: EvaluatedPolicy = {
      ...candidate,
      effect: "allow",
    };
    const result = simulatePolicyImpact({
      candidate,
      currentPolicies: [activeVersion],
      actions: [
        {
          requestId: "request-1",
          agentName: "Release Agent",
          requestedAt: new Date("2026-08-04T00:00:00.000Z"),
          input: baseInput,
        },
      ],
    });

    expect(result.changedDecisionCount).toBe(1);
    expect(result.rows[0]).toMatchObject({
      baselineEffect: "allow",
      simulatedEffect: "approval",
    });
  });
});
