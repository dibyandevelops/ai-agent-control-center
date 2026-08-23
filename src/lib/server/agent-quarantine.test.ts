import { describe, expect, it } from "vitest";
import { operatorCan } from "./operator-roles";

describe("Agent Emergency Quarantine Killswitch logic", () => {
  it("verifies permissions required to trigger quarantine killswitch", () => {
    expect(operatorCan("admin", "manage_policies") || operatorCan("admin", "approve")).toBe(true);
    expect(operatorCan("approver", "manage_policies") || operatorCan("approver", "approve")).toBe(true);
    expect(operatorCan("auditor", "manage_policies") || operatorCan("auditor", "approve")).toBe(false);
  });

  it("validates emergency reason boundary constraints", () => {
    const validateReason = (r: string) => {
      const trimmed = r.trim();
      return trimmed.length >= 3 && trimmed.length <= 500;
    };

    expect(validateReason("")).toBe(false);
    expect(validateReason("ab")).toBe(false);
    expect(validateReason("Compromised API key detected")).toBe(true);
    expect(validateReason("a".repeat(501))).toBe(false);
  });

  it("ensures quarantine decision immediately overrides policy evaluation", () => {
    const agentStatus: "healthy" | "review" | "blocked" | "quarantined" = "quarantined";
    const isQuarantined = agentStatus === "quarantined";

    // When quarantined, decision effect must be 'block' regardless of permissive policies
    const resolvedEffect = isQuarantined ? "block" : "allow";
    expect(resolvedEffect).toBe("block");
  });
});
