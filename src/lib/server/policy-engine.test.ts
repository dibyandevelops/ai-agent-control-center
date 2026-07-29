import { describe, expect, it } from "vitest";
import type { ActionEvaluationInput } from "./contracts";
import { evaluatePolicies, resolveRisk, type EvaluatedPolicy } from "./policy-engine";

const baseInput: ActionEvaluationInput = {
  idempotencyKey: "req-12345678",
  agent: {
    externalId: "release-agent",
    name: "Release Agent",
    ownerEmail: "platform@example.com",
    team: "Platform Engineering",
    provider: "OpenAI",
  },
  action: "github.issue.read",
  resource: "sentinelops/platform",
  environment: "staging",
  context: {},
};

const productionPolicy: EvaluatedPolicy = {
  id: "policy-prod",
  name: "Production changes require approval",
  effect: "approval",
  priority: 100,
  conditions: {
    all: [
      { field: "environment", operator: "eq", value: "production" },
      {
        field: "action",
        operator: "in",
        value: ["deploy.release", "github.release.create"],
      },
    ],
  },
};

describe("policy engine", () => {
  it("allows low-risk actions when no policy matches", () => {
    expect(evaluatePolicies(baseInput, [productionPolicy]).effect).toBe("allow");
  });

  it("requires approval for a production release", () => {
    const decision = evaluatePolicies(
      {
        ...baseInput,
        action: "deploy.release",
        environment: "production",
      },
      [productionPolicy],
    );
    expect(decision.effect).toBe("approval");
    expect(decision.policyId).toBe("policy-prod");
    expect(decision.risk).toBe("high");
  });

  it("uses the high-risk safety default without a matching policy", () => {
    const decision = evaluatePolicies(
      { ...baseInput, riskHint: "high" },
      [],
    );
    expect(decision.effect).toBe("approval");
    expect(decision.policyId).toBeNull();
  });

  it("elevates bulk exports to medium risk", () => {
    expect(
      resolveRisk({
        ...baseInput,
        action: "data.export",
        context: { recordCount: 14_820 },
      }),
    ).toBe("medium");
  });

  it("honors an explicit block policy before lower-priority rules", () => {
    const decision = evaluatePolicies(baseInput, [
      productionPolicy,
      {
        id: "policy-block",
        name: "Block protected resource",
        effect: "block",
        priority: 1,
        conditions: {
          all: [
            {
              field: "resource",
              operator: "contains",
              value: "sentinelops",
            },
          ],
        },
      },
    ]);
    expect(decision.effect).toBe("block");
  });
});
