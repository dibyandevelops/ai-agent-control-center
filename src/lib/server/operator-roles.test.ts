import { describe, expect, it } from "vitest";
import { operatorCan } from "./operator-roles";

describe("operator role permissions", () => {
  it("allows admins to perform every operator capability", () => {
    expect(operatorCan("admin", "read")).toBe(true);
    expect(operatorCan("admin", "approve")).toBe(true);
    expect(operatorCan("admin", "manage_policies")).toBe(true);
    expect(operatorCan("admin", "manage_operators")).toBe(true);
  });

  it("limits approvers to read and approval actions", () => {
    expect(operatorCan("approver", "read")).toBe(true);
    expect(operatorCan("approver", "approve")).toBe(true);
    expect(operatorCan("approver", "manage_policies")).toBe(false);
  });

  it("makes auditors read-only", () => {
    expect(operatorCan("auditor", "read")).toBe(true);
    expect(operatorCan("auditor", "approve")).toBe(false);
    expect(operatorCan("auditor", "manage_policies")).toBe(false);
  });
});
