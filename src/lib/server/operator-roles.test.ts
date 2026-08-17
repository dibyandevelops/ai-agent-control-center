import { describe, expect, it } from "vitest";
import { operatorCan } from "./operator-roles";

describe("operator role permissions", () => {
  it("allows admins to perform every operator capability", () => {
    expect(operatorCan("admin", "read")).toBe(true);
    expect(operatorCan("admin", "approve")).toBe(true);
    expect(operatorCan("admin", "manage_policies")).toBe(true);
    expect(operatorCan("admin", "manage_operators")).toBe(true);
    expect(operatorCan("admin", "manage_api_keys")).toBe(true);
    expect(operatorCan("admin", "manage_integrations")).toBe(true);
    expect(operatorCan("admin", "retry_execution")).toBe(true);
    expect(operatorCan("admin", "govern_releases")).toBe(true);
    expect(operatorCan("admin", "manage_identity")).toBe(true);
    expect(operatorCan("admin", "export_audit")).toBe(true);
    expect(operatorCan("admin", "invite_members")).toBe(true);
  });

  it("limits approvers to read and approval actions", () => {
    expect(operatorCan("approver", "read")).toBe(true);
    expect(operatorCan("approver", "approve")).toBe(true);
    expect(operatorCan("approver", "manage_policies")).toBe(false);
    expect(operatorCan("approver", "manage_api_keys")).toBe(false);
    expect(operatorCan("approver", "manage_integrations")).toBe(false);
    expect(operatorCan("approver", "retry_execution")).toBe(false);
    expect(operatorCan("approver", "govern_releases")).toBe(false);
    expect(operatorCan("approver", "manage_identity")).toBe(false);
    expect(operatorCan("approver", "export_audit")).toBe(false);
    expect(operatorCan("approver", "invite_members")).toBe(false);
  });

  it("makes auditors read-only with audit export permission", () => {
    expect(operatorCan("auditor", "read")).toBe(true);
    expect(operatorCan("auditor", "export_audit")).toBe(true);
    expect(operatorCan("auditor", "approve")).toBe(false);
    expect(operatorCan("auditor", "manage_policies")).toBe(false);
    expect(operatorCan("auditor", "manage_api_keys")).toBe(false);
    expect(operatorCan("auditor", "manage_integrations")).toBe(false);
    expect(operatorCan("auditor", "retry_execution")).toBe(false);
    expect(operatorCan("auditor", "govern_releases")).toBe(false);
    expect(operatorCan("auditor", "manage_identity")).toBe(false);
    expect(operatorCan("auditor", "invite_members")).toBe(false);
  });
});
