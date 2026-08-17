export type OperatorRole = "admin" | "approver" | "auditor";
export type OperatorCapability =
  | "read"
  | "approve"
  | "manage_policies"
  | "manage_operators"
  | "manage_api_keys"
  | "manage_integrations"
  | "retry_execution"
  | "govern_releases"
  | "manage_identity"
  | "export_audit"
  | "invite_members";

const capabilities: Record<OperatorRole, ReadonlySet<OperatorCapability>> = {
  admin: new Set([
    "read",
    "approve",
    "manage_policies",
    "manage_operators",
    "manage_api_keys",
    "manage_integrations",
    "retry_execution",
    "govern_releases",
    "manage_identity",
    "export_audit",
    "invite_members",
  ]),
  approver: new Set(["read", "approve"]),
  auditor: new Set(["read", "export_audit"]),
};

export function operatorCan(
  role: OperatorRole,
  capability: OperatorCapability,
) {
  return capabilities[role]?.has(capability) ?? false;
}
