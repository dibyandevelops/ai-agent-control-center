import { describe, expect, it } from "vitest";
import {
  canReviewPolicyActivation,
  policyResponse,
  type PolicyVersionRow,
} from "./policy-governance";

const version: PolicyVersionRow = {
  id: "version-2",
  policy_id: "policy-1",
  organization_id: "organization-1",
  version_number: 2,
  name: "Production releases",
  description: "Requires approval for every production release.",
  priority: 20,
  effect: "approval",
  conditions: {
    all: [{ field: "environment", operator: "eq", value: "production" }],
  },
  change_type: "edited",
  source_version_id: null,
  created_by_operator_id: "admin-1",
  created_by_email: "admin-one@example.com",
  created_at: new Date("2026-08-04T00:00:00.000Z"),
};

describe("policy four-eyes governance", () => {
  it("prevents an administrator from reviewing their own activation", () => {
    expect(
      canReviewPolicyActivation(
        {
          requestedByOperatorId: "admin-1",
          requestedByEmail: "admin-one@example.com",
        },
        { id: "admin-1", email: "admin-one@example.com" },
      ),
    ).toBe(false);
  });

  it("allows a different administrator to review the activation", () => {
    expect(
      canReviewPolicyActivation(
        {
          requestedByOperatorId: "admin-1",
          requestedByEmail: "admin-one@example.com",
        },
        { id: "admin-2", email: "admin-two@example.com" },
      ),
    ).toBe(true);
  });

  it("reports pending, active, and draft version states", () => {
    const base = {
      policyId: "policy-1",
      version,
      matches: 0,
    };
    expect(
      policyResponse({
        ...base,
        enabled: true,
        activeVersionNumber: 1,
        activationRequest: {
          id: "request-1",
          status: "pending" as const,
          requested_at: new Date("2026-08-04T00:00:00.000Z"),
        },
      }).activationStatus,
    ).toBe("pending");
    expect(
      policyResponse({
        ...base,
        enabled: true,
        activeVersionNumber: 2,
      }).activationStatus,
    ).toBe("active");
    expect(
      policyResponse({
        ...base,
        enabled: false,
        activeVersionNumber: null,
      }).activationStatus,
    ).toBe("draft");
  });
});
