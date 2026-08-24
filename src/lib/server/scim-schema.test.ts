import { describe, expect, it } from "vitest";
import {
  resolveRoleFromGroupName,
  roleToDefaultGroupId,
  roleToDefaultGroupName,
  SCIM_RESOURCE_TYPES,
  SCIM_SCHEMA_DEFINITIONS,
  SCIM_SCHEMAS,
} from "./scim-schema";

describe("SCIM 2.0 Schema & Group Role Resolver", () => {
  it("resolves enterprise directory group names to SentinelOps operator roles", () => {
    expect(resolveRoleFromGroupName("SentinelOps Admins")).toBe("admin");
    expect(resolveRoleFromGroupName("Okta_SecOps_Admin_Group")).toBe("admin");
    expect(resolveRoleFromGroupName("AI-Agent-Approvers")).toBe("approver");
    expect(resolveRoleFromGroupName("Release Reviewers")).toBe("approver");
    expect(resolveRoleFromGroupName("SOC2 Auditors")).toBe("auditor");
    expect(resolveRoleFromGroupName("Compliance Officers")).toBe("auditor");
    expect(resolveRoleFromGroupName("Engineering Interns")).toBe(null);
  });

  it("provides deterministic group IDs and names per role", () => {
    expect(roleToDefaultGroupId("admin")).toBe("role-group-admin");
    expect(roleToDefaultGroupId("approver")).toBe("role-group-approver");
    expect(roleToDefaultGroupId("auditor")).toBe("role-group-auditor");

    expect(roleToDefaultGroupName("admin")).toBe("SentinelOps Admins");
    expect(roleToDefaultGroupName("approver")).toBe("SentinelOps Approvers");
    expect(roleToDefaultGroupName("auditor")).toBe("SentinelOps Auditors");
  });

  it("defines standard SCIM 2.0 User and Group resource types", () => {
    expect(SCIM_RESOURCE_TYPES).toHaveLength(2);
    const userType = SCIM_RESOURCE_TYPES.find((t) => t.id === "User");
    const groupType = SCIM_RESOURCE_TYPES.find((t) => t.id === "Group");

    expect(userType?.endpoint).toBe("/Users");
    expect(userType?.schema).toBe(SCIM_SCHEMAS.USER);
    expect(groupType?.endpoint).toBe("/Groups");
    expect(groupType?.schema).toBe(SCIM_SCHEMAS.GROUP);
  });

  it("contains valid schema definitions for User and Group", () => {
    expect(SCIM_SCHEMA_DEFINITIONS).toHaveLength(2);
    const userSchema = SCIM_SCHEMA_DEFINITIONS.find((s) => s.id === SCIM_SCHEMAS.USER);
    const groupSchema = SCIM_SCHEMA_DEFINITIONS.find((s) => s.id === SCIM_SCHEMAS.GROUP);

    expect(userSchema?.name).toBe("User");
    expect(userSchema?.attributes.some((a) => a.name === "userName")).toBe(true);
    expect(groupSchema?.name).toBe("Group");
    expect(groupSchema?.attributes.some((a) => a.name === "members")).toBe(true);
  });
});
