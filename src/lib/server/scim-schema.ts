import { OperatorRole } from "./operator-roles";

export const SCIM_SCHEMAS = {
  USER: "urn:ietf:params:scim:schemas:core:2.0:User",
  GROUP: "urn:ietf:params:scim:schemas:core:2.0:Group",
  RESOURCE_TYPE: "urn:ietf:params:scim:schemas:core:2.0:ResourceType",
  SERVICE_PROVIDER_CONFIG: "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig",
  LIST_RESPONSE: "urn:ietf:params:scim:api:messages:2.0:ListResponse",
  ERROR: "urn:ietf:params:scim:api:messages:2.0:Error",
} as const;

export interface ScimGroupMember {
  value: string;
  display?: string;
  $ref?: string;
  type?: "User";
}

export interface ScimGroupResource {
  schemas: [typeof SCIM_SCHEMAS.GROUP];
  id: string;
  displayName: string;
  members: ScimGroupMember[];
  meta: {
    resourceType: "Group";
    created: string;
    lastModified: string;
    location: string;
  };
}

export const SCIM_RESOURCE_TYPES = [
  {
    schemas: [SCIM_SCHEMAS.RESOURCE_TYPE],
    id: "User",
    name: "User",
    endpoint: "/Users",
    description: "User Account",
    schema: SCIM_SCHEMAS.USER,
    meta: {
      location: "/ResourceTypes/User",
      resourceType: "ResourceType",
    },
  },
  {
    schemas: [SCIM_SCHEMAS.RESOURCE_TYPE],
    id: "Group",
    name: "Group",
    endpoint: "/Groups",
    description: "Group Resource for Role Assignment",
    schema: SCIM_SCHEMAS.GROUP,
    meta: {
      location: "/ResourceTypes/Group",
      resourceType: "ResourceType",
    },
  },
];

export const SCIM_SCHEMA_DEFINITIONS = [
  {
    id: SCIM_SCHEMAS.USER,
    name: "User",
    description: "Core User Schema",
    attributes: [
      { name: "userName", type: "string", multiValued: false, required: true, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "server" },
      { name: "name", type: "complex", multiValued: false, required: false, subAttributes: [
        { name: "formatted", type: "string", multiValued: false, required: false },
        { name: "familyName", type: "string", multiValued: false, required: false },
        { name: "givenName", type: "string", multiValued: false, required: false },
      ] },
      { name: "displayName", type: "string", multiValued: false, required: false },
      { name: "active", type: "boolean", multiValued: false, required: false },
      { name: "emails", type: "complex", multiValued: true, required: true, subAttributes: [
        { name: "value", type: "string", multiValued: false, required: true },
        { name: "primary", type: "boolean", multiValued: false, required: false },
        { name: "type", type: "string", multiValued: false, required: false },
      ] },
      { name: "roles", type: "complex", multiValued: true, required: false, subAttributes: [
        { name: "value", type: "string", multiValued: false, required: true },
        { name: "primary", type: "boolean", multiValued: false, required: false },
      ] },
    ],
    meta: {
      resourceType: "Schema",
      location: `/Schemas/${SCIM_SCHEMAS.USER}`,
    },
  },
  {
    id: SCIM_SCHEMAS.GROUP,
    name: "Group",
    description: "Core Group Schema for Role Synchronization",
    attributes: [
      { name: "displayName", type: "string", multiValued: false, required: true, caseExact: false, mutability: "readWrite", returned: "default", uniqueness: "server" },
      { name: "members", type: "complex", multiValued: true, required: false, mutability: "readWrite", returned: "default", subAttributes: [
        { name: "value", type: "string", multiValued: false, required: true },
        { name: "$ref", type: "reference", multiValued: false, required: false },
        { name: "display", type: "string", multiValued: false, required: false },
        { name: "type", type: "string", multiValued: false, required: false },
      ] },
    ],
    meta: {
      resourceType: "Schema",
      location: `/Schemas/${SCIM_SCHEMAS.GROUP}`,
    },
  },
];

/**
 * Normalizes an enterprise IdP Group display name into a SentinelOps OperatorRole.
 * E.g.: "SentinelOps-Admins" -> "admin"
 *       "AI Governance Approvers" -> "approver"
 *       "Auditors" -> "auditor"
 */
export function resolveRoleFromGroupName(groupName: string): OperatorRole | null {
  const normalized = groupName.trim().toLowerCase();
  if (normalized.includes("admin")) return "admin";
  if (normalized.includes("approver") || normalized.includes("review")) return "approver";
  if (normalized.includes("audit") || normalized.includes("compliance") || normalized.includes("read")) return "auditor";
  return null;
}

export function roleToDefaultGroupId(role: OperatorRole): string {
  return `role-group-${role}`;
}

export function roleToDefaultGroupName(role: OperatorRole): string {
  switch (role) {
    case "admin":
      return "SentinelOps Admins";
    case "approver":
      return "SentinelOps Approvers";
    case "auditor":
      return "SentinelOps Auditors";
  }
}
