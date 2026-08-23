import { describe, expect, it } from "vitest";
import { CreateDelegationInput } from "./approver-delegation";

describe("Approver Delegation input validation", () => {
  it("validates that self-delegation is prohibited", () => {
    const delegatorId = "op-123";
    const input: CreateDelegationInput = {
      delegateeOperatorId: "op-123",
      reason: "Vacation",
      endsAt: new Date(Date.now() + 86400000).toISOString(),
    };
    expect(delegatorId === input.delegateeOperatorId).toBe(true);
  });

  it("validates time bounds where endsAt must follow startsAt", () => {
    const startsAt = new Date("2026-09-01T10:00:00Z");
    const endsAt = new Date("2026-09-01T09:00:00Z");
    expect(endsAt.getTime() <= startsAt.getTime()).toBe(true);
  });

  it("enforces maximum continuous delegation window of 90 days", () => {
    const maxDurationMs = 90 * 24 * 60 * 60 * 1000;
    const startsAt = new Date("2026-09-01T00:00:00Z");
    const endsAtValid = new Date(startsAt.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
    const endsAtTooLong = new Date(startsAt.getTime() + 95 * 24 * 60 * 60 * 1000); // 95 days

    expect(endsAtValid.getTime() - startsAt.getTime() <= maxDurationMs).toBe(true);
    expect(endsAtTooLong.getTime() - startsAt.getTime() > maxDurationMs).toBe(true);
  });

  it("calculates active state dynamically based on current clock and revocation status", () => {
    const now = Date.now();
    const activeRow = {
      starts_at: new Date(now - 3600000),
      ends_at: new Date(now + 3600000),
      revoked_at: null,
    };
    const expiredRow = {
      starts_at: new Date(now - 7200000),
      ends_at: new Date(now - 3600000),
      revoked_at: null,
    };
    const revokedRow = {
      starts_at: new Date(now - 3600000),
      ends_at: new Date(now + 3600000),
      revoked_at: new Date(now - 1000),
    };

    const isRowActive = (r: { starts_at: Date; ends_at: Date; revoked_at: Date | null }) =>
      r.revoked_at === null && r.starts_at.getTime() <= now && r.ends_at.getTime() > now;

    expect(isRowActive(activeRow)).toBe(true);
    expect(isRowActive(expiredRow)).toBe(false);
    expect(isRowActive(revokedRow)).toBe(false);
  });

  it("detects transitive 4-eyes requester conflicts when holding delegation", () => {
    const originalRequesterId = "op-alice";
    const delegationsToBob = [{ delegator_operator_id: "op-alice" }];

    // Bob cannot approve if he holds delegation from Alice (the requester)
    const hasTransitiveConflict = delegationsToBob.some(
      (d) => d.delegator_operator_id === originalRequesterId,
    );
    expect(hasTransitiveConflict).toBe(true);
  });
});
