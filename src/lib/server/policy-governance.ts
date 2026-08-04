import type { PoolClient } from "pg";
import { ConflictError, NotFoundError } from "./errors";
import type { PolicyConditions } from "./contracts";

export type PolicyEffect = "allow" | "approval" | "block";

export function canReviewPolicyActivation(
  request: {
    requestedByOperatorId: string | null;
    requestedByEmail: string;
  },
  reviewer: { id: string; email: string },
) {
  return (
    request.requestedByOperatorId !== reviewer.id &&
    request.requestedByEmail !== reviewer.email
  );
}

export interface PolicyConfiguration {
  name: string;
  description: string;
  priority: number;
  effect: PolicyEffect;
  conditions: PolicyConditions;
}

export interface LockedPolicy {
  id: string;
  organization_id: string;
  enabled: boolean;
  active_version_id: string | null;
}

export interface PolicyVersionRow extends PolicyConfiguration {
  id: string;
  policy_id: string;
  organization_id: string;
  version_number: number;
  change_type: "created" | "edited" | "rollback";
  source_version_id: string | null;
  created_by_operator_id: string | null;
  created_by_email: string;
  created_at: Date;
}

export async function lockPolicy(
  client: PoolClient,
  policyId: string,
  organizationId: string,
) {
  const result = await client.query<LockedPolicy>(
    `
      select id, organization_id, enabled, active_version_id
      from policies
      where id = $1 and organization_id = $2
      for update
    `,
    [policyId, organizationId],
  );
  const policy = result.rows[0];
  if (!policy) throw new NotFoundError("Policy not found.");
  return policy;
}

export async function loadLatestPolicyVersion(
  client: PoolClient,
  policyId: string,
  organizationId: string,
) {
  const result = await client.query<PolicyVersionRow>(
    `
      select *
      from policy_versions
      where policy_id = $1 and organization_id = $2
      order by version_number desc
      limit 1
    `,
    [policyId, organizationId],
  );
  const version = result.rows[0];
  if (!version) throw new NotFoundError("Policy version not found.");
  return version;
}

export async function insertPolicyVersion(
  client: PoolClient,
  {
    policy,
    configuration,
    operator,
    changeType,
    sourceVersionId = null,
  }: {
    policy: LockedPolicy;
    configuration: PolicyConfiguration;
    operator: { id: string; email: string };
    changeType: "created" | "edited" | "rollback";
    sourceVersionId?: string | null;
  },
) {
  const versionResult = await client.query<PolicyVersionRow>(
    `
      insert into policy_versions (
        organization_id,
        policy_id,
        version_number,
        name,
        description,
        priority,
        effect,
        conditions,
        change_type,
        source_version_id,
        created_by_operator_id,
        created_by_email
      )
      select
        $1,
        $2,
        coalesce(max(version_number), 0) + 1,
        $3,
        $4,
        $5,
        $6,
        $7::jsonb,
        $8,
        $9,
        $10,
        $11
      from policy_versions
      where policy_id = $2
      returning *
    `,
    [
      policy.organization_id,
      policy.id,
      configuration.name,
      configuration.description,
      configuration.priority,
      configuration.effect,
      JSON.stringify(configuration.conditions),
      changeType,
      sourceVersionId,
      operator.id,
      operator.email,
    ],
  );
  return versionResult.rows[0];
}

export async function ensureNoPendingActivation(
  client: PoolClient,
  policyId: string,
) {
  const pending = await client.query<{ id: string }>(
    `
      select id
      from policy_activation_requests
      where policy_id = $1 and status = 'pending'
      limit 1
    `,
    [policyId],
  );
  if (pending.rows[0]) {
    throw new ConflictError(
      "This policy already has an activation awaiting review.",
    );
  }
}

export async function createActivationRequest(
  client: PoolClient,
  {
    policy,
    version,
    operator,
  }: {
    policy: LockedPolicy;
    version: PolicyVersionRow;
    operator: { id: string; email: string };
  },
) {
  await ensureNoPendingActivation(client, policy.id);
  const result = await client.query<{
    id: string;
    status: "pending";
    requested_at: Date;
  }>(
    `
      insert into policy_activation_requests (
        organization_id,
        policy_id,
        version_id,
        requested_by_operator_id,
        requested_by_email
      )
      values ($1, $2, $3, $4, $5)
      returning id, status, requested_at
    `,
    [
      policy.organization_id,
      policy.id,
      version.id,
      operator.id,
      operator.email,
    ],
  );
  return result.rows[0];
}

export function policyMode(effect: PolicyEffect) {
  if (effect === "block") return "Block" as const;
  if (effect === "approval") return "Approval" as const;
  return "Monitor" as const;
}

export function policyResponse({
  policyId,
  version,
  enabled,
  activeVersionNumber,
  activationRequest,
  matches = 0,
}: {
  policyId: string;
  version: PolicyVersionRow;
  enabled: boolean;
  activeVersionNumber: number | null;
  activationRequest?: {
    id: string;
    status: "pending";
    requested_at: Date;
  } | null;
  matches?: number;
}) {
  return {
    id: policyId,
    name: version.name,
    description: version.description,
    scope: "Live organization",
    mode: policyMode(version.effect),
    effect: version.effect,
    priority: version.priority,
    conditions: version.conditions.all,
    enabled,
    matches,
    latestVersionNumber: version.version_number,
    activeVersionNumber,
    activationStatus: activationRequest
      ? "pending"
      : enabled && version.version_number === activeVersionNumber
        ? "active"
        : "draft",
    pendingActivation: activationRequest
      ? {
          id: activationRequest.id,
          requestedAt: activationRequest.requested_at.toISOString(),
        }
      : null,
  };
}
