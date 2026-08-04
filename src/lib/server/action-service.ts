import "server-only";

import type { NextRequest } from "next/server";
import type { PoolClient } from "pg";
import type {
  ActionEvaluationInput,
  DecisionInput,
  ExecutionOutcomeInput,
} from "./contracts";
import { policyConditionsSchema } from "./contracts";
import { appendAuditEvent } from "./audit";
import { authenticateApiKey } from "./auth";
import { evaluatePolicies, type EvaluatedPolicy } from "./policy-engine";
import { withTransaction } from "./db";
import {
  evaluateExecutionTransition,
  isTerminalExecutionStatus,
  type ExecutionStatus,
} from "./execution-state";
import { AuthenticationError, ConflictError, NotFoundError } from "./errors";

interface ActionRequestRow {
  id: string;
  organization_id: string;
  agent_id: string;
  policy_id: string | null;
  policy_version_id: string | null;
  action: string;
  resource: string;
  environment: "development" | "staging" | "production";
  risk: "low" | "medium" | "high";
  context: Record<string, unknown>;
  decision_status: "allowed" | "pending" | "approved" | "denied" | "blocked";
  decision_reason: string;
  decided_by: string | null;
  decided_at: Date | null;
  requested_at: Date;
  execution_status: ExecutionStatus;
  execution_started_at: Date | null;
  execution_completed_at: Date | null;
  execution_external_reference: string | null;
  execution_summary: string | null;
  execution_error_code: string | null;
}

function serializeRequest(row: ActionRequestRow) {
  return {
    requestId: row.id,
    action: row.action,
    resource: row.resource,
    environment: row.environment,
    risk: row.risk,
    status: row.decision_status,
    reason: row.decision_reason,
    policyId: row.policy_id,
    policyVersionId: row.policy_version_id,
    context: row.context,
    requestedAt: row.requested_at.toISOString(),
    decidedAt: row.decided_at?.toISOString() ?? null,
    decidedBy: row.decided_by,
    execution: {
      status: row.execution_status,
      startedAt: row.execution_started_at?.toISOString() ?? null,
      completedAt: row.execution_completed_at?.toISOString() ?? null,
      externalReference: row.execution_external_reference,
      summary: row.execution_summary,
      errorCode: row.execution_error_code,
    },
  };
}

async function loadPolicies(
  client: PoolClient,
  organizationId: string,
): Promise<EvaluatedPolicy[]> {
  const result = await client.query<{
    id: string;
    version_id: string;
    name: string;
    effect: "allow" | "approval" | "block";
    priority: number;
    conditions: unknown;
  }>(
    `
      select
        p.id,
        pv.id as version_id,
        pv.name,
        pv.effect,
        pv.priority,
        pv.conditions
      from policies p
      join policy_versions pv on pv.id = p.active_version_id
      where p.organization_id = $1
        and p.enabled = true
      order by pv.priority asc, p.id asc
    `,
    [organizationId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    versionId: row.version_id,
    name: row.name,
    effect: row.effect,
    priority: row.priority,
    conditions: policyConditionsSchema.parse(row.conditions),
  }));
}

export async function evaluateAction(
  request: NextRequest,
  input: ActionEvaluationInput,
) {
  return withTransaction(async (client) => {
    const identity = await authenticateApiKey(request, client);
    if (!identity) throw new AuthenticationError("Invalid agent API key.");

    const existing = await client.query<ActionRequestRow>(
      `
        select *
        from action_requests
        where organization_id = $1
          and idempotency_key = $2
        limit 1
      `,
      [identity.organizationId, input.idempotencyKey],
    );
    if (existing.rows[0]) {
      return {
        organization: identity.organizationName,
        replayed: true,
        ...serializeRequest(existing.rows[0]),
      };
    }

    const agentResult = await client.query<{ id: string }>(
      `
        insert into agents (
          organization_id,
          external_id,
          name,
          owner_email,
          team,
          provider,
          environment,
          last_seen_at,
          updated_at
        )
        values ($1, $2, $3, $4, $5, $6, $7, now(), now())
        on conflict (organization_id, external_id) do update
        set name = excluded.name,
            owner_email = excluded.owner_email,
            team = excluded.team,
            provider = excluded.provider,
            environment = excluded.environment,
            last_seen_at = now(),
            updated_at = now()
        returning id
      `,
      [
        identity.organizationId,
        input.agent.externalId,
        input.agent.name,
        input.agent.ownerEmail,
        input.agent.team,
        input.agent.provider,
        input.environment,
      ],
    );
    const agentId = agentResult.rows[0].id;
    const policies = await loadPolicies(client, identity.organizationId);
    const decision = evaluatePolicies(input, policies);
    const status =
      decision.effect === "approval"
        ? "pending"
        : decision.effect === "allow"
          ? "allowed"
          : "blocked";
    const expiresAt =
      status === "pending" ? new Date(Date.now() + 30 * 60 * 1_000) : null;

    const requestResult = await client.query<ActionRequestRow>(
      `
        insert into action_requests (
          organization_id,
          agent_id,
          policy_id,
          policy_version_id,
          idempotency_key,
          action,
          resource,
          environment,
          risk,
          context,
          decision_status,
          decision_reason,
          decided_by,
          decided_at,
          expires_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb,
          $11, $12,
          case when $11 in ('allowed', 'blocked') then 'Policy engine' end,
          case when $11 in ('allowed', 'blocked') then now() end,
          $13
        )
        returning *
      `,
      [
        identity.organizationId,
        agentId,
        decision.policyId,
        decision.policyVersionId,
        input.idempotencyKey,
        input.action,
        input.resource,
        input.environment,
        decision.risk,
        JSON.stringify(input.context),
        status,
        decision.reason,
        expiresAt,
      ],
    );
    const actionRequest = requestResult.rows[0];

    await appendAuditEvent(client, {
      organizationId: identity.organizationId,
      requestId: actionRequest.id,
      eventType: "action.evaluated",
      actorType: "policy",
      actorId: decision.policyId ?? "safety-default",
      payload: {
        action: input.action,
        resource: input.resource,
        status,
        risk: decision.risk,
        reason: decision.reason,
        policyVersionId: decision.policyVersionId,
      },
    });

    return {
      organization: identity.organizationName,
      replayed: false,
      ...serializeRequest(actionRequest),
    };
  });
}

export async function decideAction(
  requestId: string,
  input: DecisionInput,
  operator: { organizationId: string; email: string },
) {
  return withTransaction(async (client) => {
    const result = await client.query<ActionRequestRow>(
      `
        update action_requests
        set decision_status = $2,
            decision_reason = $3,
            decided_by = $4,
            decided_at = now()
        where id = $1
          and organization_id = $5
          and decision_status = 'pending'
          and (expires_at is null or expires_at > now())
        returning *
      `,
      [
        requestId,
        input.decision,
        input.reason,
        operator.email,
        operator.organizationId,
      ],
    );
    const actionRequest = result.rows[0];
    if (!actionRequest) {
      const current = await client.query<ActionRequestRow>(
        "select * from action_requests where id = $1 and organization_id = $2",
        [requestId, operator.organizationId],
      );
      if (!current.rows[0]) throw new NotFoundError("Request not found.");
      throw new ConflictError(
        `Request is already ${current.rows[0].decision_status} or expired.`,
      );
    }

    await appendAuditEvent(client, {
      organizationId: actionRequest.organization_id,
      requestId: actionRequest.id,
      eventType: `action.${input.decision}`,
      actorType: "human",
      actorId: operator.email,
      payload: {
        decision: input.decision,
        reason: input.reason,
      },
    });

    return serializeRequest(actionRequest);
  });
}

export async function getActionForAgent(
  request: NextRequest,
  requestId: string,
) {
  return withTransaction(async (client) => {
    const identity = await authenticateApiKey(request, client);
    if (!identity) throw new AuthenticationError("Invalid agent API key.");
    const result = await client.query<ActionRequestRow>(
      `
        select *
        from action_requests
        where id = $1
          and organization_id = $2
        limit 1
      `,
      [requestId, identity.organizationId],
    );
    if (!result.rows[0]) throw new NotFoundError("Request not found.");
    return serializeRequest(result.rows[0]);
  });
}

export async function reportExecutionOutcome(
  request: NextRequest,
  requestId: string,
  input: ExecutionOutcomeInput,
) {
  return withTransaction(async (client) => {
    const identity = await authenticateApiKey(request, client);
    if (!identity) throw new AuthenticationError("Invalid agent API key.");

    const currentResult = await client.query<ActionRequestRow>(
      `
        select *
        from action_requests
        where id = $1
          and organization_id = $2
        for update
      `,
      [requestId, identity.organizationId],
    );
    const current = currentResult.rows[0];
    if (!current) throw new NotFoundError("Request not found.");

    if (!["allowed", "approved"].includes(current.decision_status)) {
      throw new ConflictError(
        `Execution cannot be reported while the request is ${current.decision_status}.`,
      );
    }

    const transition = evaluateExecutionTransition(
      current.execution_status,
      input.status,
    );
    if (transition === "replay") {
      return { replayed: true, ...serializeRequest(current) };
    }

    if (transition === "conflict") {
      throw new ConflictError(
        `Execution is already ${current.execution_status} and cannot be changed.`,
      );
    }

    const isTerminal = isTerminalExecutionStatus(input.status);
    const updateResult = await client.query<ActionRequestRow>(
      `
        update action_requests
        set execution_status = $3,
            execution_started_at = coalesce(execution_started_at, now()),
            execution_completed_at =
              case when $4::boolean then now() else null end,
            execution_external_reference = $5,
            execution_summary = $6,
            execution_error_code = $7
        where id = $1
          and organization_id = $2
        returning *
      `,
      [
        requestId,
        identity.organizationId,
        input.status,
        isTerminal,
        input.externalReference ?? null,
        input.summary,
        input.errorCode ?? null,
      ],
    );
    const actionRequest = updateResult.rows[0];

    await appendAuditEvent(client, {
      organizationId: identity.organizationId,
      requestId: actionRequest.id,
      eventType: `action.execution_${input.status}`,
      actorType: "agent",
      actorId: `api-key:${identity.keyId}`,
      payload: {
        status: input.status,
        summary: input.summary,
        externalReference: input.externalReference ?? null,
        errorCode: input.errorCode ?? null,
      },
    });

    return { replayed: false, ...serializeRequest(actionRequest) };
  });
}
