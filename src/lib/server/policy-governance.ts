import type { PoolClient } from "pg";
import { ConflictError, NotFoundError } from "./errors";
import type { ActionEvaluationInput, PolicyConditions } from "./contracts";
import type { EvaluatedPolicy } from "./policy-engine";
import { simulatePolicyImpact } from "./policy-simulation";

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

export interface ExpiredPolicyActivation {
  id: string;
  version_id: string;
  expires_at: Date;
  requested_by_email: string;
  policy_name: string;
  version_number: number;
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
  onExpired?: (activation: ExpiredPolicyActivation) => Promise<unknown>,
) {
  const expiredResult = await client.query<ExpiredPolicyActivation>(
    `
      update policy_activation_requests
      set status = 'expired',
          reviewed_at = now(),
          review_reason = 'Activation request expired before independent review.'
      from policy_versions pv
      where policy_activation_requests.policy_id = $1
        and policy_activation_requests.status = 'pending'
        and policy_activation_requests.expires_at <= now()
        and policy_activation_requests.version_id = pv.id
      returning policy_activation_requests.id,
                policy_activation_requests.version_id,
                policy_activation_requests.expires_at,
                policy_activation_requests.requested_by_email,
                pv.name as policy_name,
                pv.version_number
    `,
    [policyId],
  );
  if (onExpired) {
    for (const activation of expiredResult.rows) {
      await onExpired(activation);
    }
  }
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
    schedule = { ttlHours: 24, reminderMinutes: 240 },
    onExpired,
  }: {
    policy: LockedPolicy;
    version: PolicyVersionRow;
    operator: { id: string; email: string };
    schedule?: { ttlHours: number; reminderMinutes: number };
    onExpired?: (activation: ExpiredPolicyActivation) => Promise<unknown>;
  },
) {
  await ensureNoPendingActivation(client, policy.id, onExpired);
  const simulationEvidence = await captureActivationSimulation(
    client,
    policy.organization_id,
    version,
  );
  const result = await client.query<{
    id: string;
    status: "pending";
    requested_at: Date;
    expires_at: Date;
  }>(
    `
      insert into policy_activation_requests (
        organization_id,
        policy_id,
        version_id,
        requested_by_operator_id,
        requested_by_email,
        simulation_evidence,
        expires_at,
        next_reminder_at
      )
      values (
        $1, $2, $3, $4, $5, $6::jsonb,
        now() + ($7 * interval '1 hour'),
        least(
          now() + ($8 * interval '1 minute'),
          now() + ($7 * interval '1 hour')
        )
      )
      returning id, status, requested_at, expires_at
    `,
    [
      policy.organization_id,
      policy.id,
      version.id,
      operator.id,
      operator.email,
      JSON.stringify(simulationEvidence),
      schedule.ttlHours,
      schedule.reminderMinutes,
    ],
  );
  return result.rows[0];
}

async function captureActivationSimulation(
  client: PoolClient,
  organizationId: string,
  version: PolicyVersionRow,
) {
  const [policiesResult, actionsResult] = await Promise.all([
    client.query<{
      id: string;
      version_id: string;
      name: string;
      effect: PolicyEffect;
      priority: number;
      conditions: PolicyConditions;
    }>(
      `
        select p.id, pv.id as version_id, pv.name, pv.effect,
               pv.priority, pv.conditions
        from policies p
        join policy_versions pv on pv.id = p.active_version_id
        where p.organization_id = $1 and p.enabled = true
        order by pv.priority asc, p.id asc
      `,
      [organizationId],
    ),
    client.query<{
      id: string;
      action: string;
      resource: string;
      environment: "development" | "staging" | "production";
      risk: "low" | "medium" | "high";
      context: ActionEvaluationInput["context"];
      requested_at: Date;
      agent_external_id: string;
      agent_name: string;
      owner_email: string;
      team: string;
      provider: string;
    }>(
      `
        select ar.id, ar.action, ar.resource, ar.environment, ar.risk,
               ar.context, ar.requested_at, a.external_id as agent_external_id,
               a.name as agent_name, a.owner_email, a.team, a.provider
        from action_requests ar
        join agents a on a.id = ar.agent_id
        where ar.organization_id = $1
        order by ar.requested_at desc, ar.id desc
        limit 50
      `,
      [organizationId],
    ),
  ]);
  const candidate: EvaluatedPolicy = {
    id: version.policy_id,
    versionId: version.id,
    name: version.name,
    effect: version.effect,
    priority: version.priority,
    conditions: version.conditions,
  };
  const currentPolicies: EvaluatedPolicy[] = policiesResult.rows.map((row) => ({
    id: row.id,
    versionId: row.version_id,
    name: row.name,
    effect: row.effect,
    priority: row.priority,
    conditions: row.conditions,
  }));
  const actions = actionsResult.rows.map((row) => ({
    requestId: row.id,
    agentName: row.agent_name,
    requestedAt: row.requested_at,
    input: {
      idempotencyKey: `activation-simulation-${row.id}`,
      agent: {
        externalId: row.agent_external_id,
        name: row.agent_name,
        ownerEmail: row.owner_email,
        team: row.team,
        provider: row.provider,
      },
      action: row.action,
      resource: row.resource,
      environment: row.environment,
      riskHint: row.risk,
      context: row.context,
    },
  }));
  const result = simulatePolicyImpact({ candidate, currentPolicies, actions });
  return {
    actionsEvaluated: result.actionsEvaluated,
    matchedCount: result.matchedCount,
    determiningCount: result.determiningCount,
    changedDecisionCount: result.changedDecisionCount,
    simulatedAt: new Date().toISOString(),
    changedActions: result.rows
      .filter((row) => row.decisionChanged)
      .slice(0, 5)
      .map((row) => ({
        requestId: row.requestId,
        agentName: row.agentName,
        action: row.action,
        resource: row.resource,
        baselineEffect: row.baselineEffect,
        simulatedEffect: row.simulatedEffect,
      })),
  };
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
    expires_at: Date;
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
          expiresAt: activationRequest.expires_at.toISOString(),
        }
      : null,
  };
}
