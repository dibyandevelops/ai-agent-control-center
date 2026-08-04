export type OperatorRole = "admin" | "approver" | "auditor";
export type OperatorCapability =
  | "read"
  | "approve"
  | "manage_policies"
  | "manage_operators";

const capabilities: Record<OperatorRole, ReadonlySet<OperatorCapability>> = {
  admin: new Set(["read", "approve", "manage_policies", "manage_operators"]),
  approver: new Set(["read", "approve"]),
  auditor: new Set(["read"]),
};

export function operatorCan(
  role: OperatorRole,
  capability: OperatorCapability,
) {
  return capabilities[role].has(capability);
}
