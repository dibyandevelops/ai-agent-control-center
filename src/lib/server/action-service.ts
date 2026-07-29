import "server-only";

import type { NextRequest } from "next/server";
import type { PoolClient } from "pg";
import type { ActionEvaluationInput, DecisionInput } from "./contracts";
import { policyConditionsSchema } from "./contracts";
import { appendAuditEvent } from "./audit";
import { authenticateApiKey } from "./auth";
import { evaluatePolicies, type EvaluatedPolicy } from "./policy-engine";
import { withTransaction } from "./db";

export class AuthenticationError extends Error {}
export class ConflictError extends Error {}
export class NotFoundError extends Error {}

interface ActionRequestRow {
  id: string;
  organization_id: string;
  agent_id: string;
  policy_id: string | null;
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
    context: row.context,
    requestedAt: row.requested_at.toISOString(),
    decidedAt: row.decided_at?.toISOString() ?? null,
    decidedBy: row.decided_by,
  };
}

async function loadPolicies(
  client: PoolClient,
  organizationId: string,
): Promise<EvaluatedPolicy[]> {
  const result = await client.query<{
    id: string;
    name: string;
    effect: "allow" | "approval" | "block";
    priority: number;
    conditions: unknown;
  }>(
    `
      select id, name, effect, priority, conditions
      from policies
      where organization_id = $1
        and enabled = true
      order by priority asc
    `,
    [organizationId],
  );

  return result.rows.map((row) => ({
    ...row,
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
          $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb,
          $10, $11,
          case when $10 in ('allowed', 'blocked') then 'Policy engine' end,
          case when $10 in ('allowed', 'blocked') then now() end,
          $12
        )
        returning *
      `,
      [
        identity.organizationId,
        agentId,
        decision.policyId,
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
          and decision_status = 'pending'
          and (expires_at is null or expires_at > now())
        returning *
      `,
      [
        requestId,
        input.decision,
        input.reason,
        input.actor,
      ],
    );
    const actionRequest = result.rows[0];
    if (!actionRequest) {
      const current = await client.query<ActionRequestRow>(
        "select * from action_requests where id = $1",
        [requestId],
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
      actorId: input.actor,
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
