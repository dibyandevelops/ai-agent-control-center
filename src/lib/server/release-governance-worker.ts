import "server-only";

import { randomUUID } from "node:crypto";
import { appendAuditEvent } from "./audit";
import { withTransaction } from "./db";
import { getServerEnv } from "./env";
import { transitionGitHubDraftRelease } from "./github-draft-release";
import { findActiveReleaseContainment } from "./github-release-containment";
import { resolveReleaseExecutionPlan } from "./release-execution-core";

interface ClaimedGovernance {
  id: string;
  organization_id: string;
  action_request_id: string;
  operation: "publish" | "cancel";
  action: string;
  resource: string;
  context: Record<string, unknown>;
  execution_attempt_count: number;
  reclaimed: boolean;
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "GitHub draft operation failed.")
    .slice(0, 1_000);
}

async function claimGovernance(input: {
  workerId: string;
  governanceId?: string;
  limit: number;
  leaseMinutes: number;
}) {
  return withTransaction(async (client) => {
    const result = await client.query<ClaimedGovernance>(
      `
        with candidates as (
          select governance.id, governance.status = 'executing' as reclaimed
          from release_draft_governance_requests governance
          join action_requests action on action.id = governance.action_request_id
          where action.decision_status = 'approved'
            and action.execution_status = 'succeeded'
            and not exists (
              select 1
              from github_release_drift_incidents incident
              where incident.organization_id = governance.organization_id
                and incident.severity = 'critical'
                and incident.status in ('open', 'acknowledged')
                and lower(incident.containment_resource) = lower(action.resource)
            )
            and ($2::uuid is null or governance.id = $2::uuid)
            and (
              governance.status = 'approved'
              or (
                governance.status = 'executing'
                and governance.execution_locked_at <=
                  now() - ($4 * interval '1 minute')
              )
            )
          order by governance.requested_at asc, governance.id asc
          for update of governance skip locked
          limit $3
        )
        update release_draft_governance_requests governance
        set status = 'executing',
            execution_worker_id = $1,
            execution_locked_at = now(),
            execution_started_at = coalesce(governance.execution_started_at, now()),
            execution_completed_at = null,
            execution_attempt_count = governance.execution_attempt_count + 1,
            execution_summary = case when candidates.reclaimed
              then 'GitHub draft governance lease reclaimed.'
              else 'Approved GitHub draft operation started.' end,
            execution_error_code = null
        from candidates, action_requests action
        where governance.id = candidates.id
          and action.id = governance.action_request_id
        returning governance.id, governance.organization_id,
                  governance.action_request_id, governance.operation,
                  action.action, action.resource, action.context,
                  governance.execution_attempt_count, candidates.reclaimed
      `,
      [input.workerId, input.governanceId ?? null, input.limit, input.leaseMinutes],
    );
    for (const row of result.rows) {
      await appendAuditEvent(client, {
        organizationId: row.organization_id,
        requestId: row.action_request_id,
        eventType: row.reclaimed
          ? "release.draft_governance_reclaimed"
          : `release.draft_${row.operation}_executing`,
        actorType: "system",
        actorId: "release-governance-worker",
        payload: {
          governanceRequestId: row.id,
          operation: row.operation,
          status: "executing",
          attemptCount: row.execution_attempt_count,
        },
      });
    }
    return result.rows;
  });
}

async function finalizeGovernance(input: {
  workerId: string;
  governance: ClaimedGovernance;
  status: "succeeded" | "failed";
  summary: string;
  externalReference?: string | null;
  errorCode?: string;
}) {
  return withTransaction(async (client) => {
    const updated = await client.query<{ id: string }>(
      `
        update release_draft_governance_requests
        set status = $3, execution_completed_at = now(),
            execution_summary = $4, execution_error_code = $5,
            execution_external_reference = $6,
            execution_worker_id = null, execution_locked_at = null
        where id = $1 and execution_worker_id = $2 and status = 'executing'
        returning id
      `,
      [
        input.governance.id,
        input.workerId,
        input.status,
        input.summary,
        input.errorCode ?? null,
        input.externalReference ?? null,
      ],
    );
    if (!updated.rows[0]) return false;
    await appendAuditEvent(client, {
      organizationId: input.governance.organization_id,
      requestId: input.governance.action_request_id,
      eventType: `release.draft_${input.governance.operation}_${input.status}`,
      actorType: "system",
      actorId: "release-governance-worker",
      payload: {
        governanceRequestId: input.governance.id,
        operation: input.governance.operation,
        status: input.status,
        summary: input.summary,
        errorCode: input.errorCode ?? null,
        externalReference: input.externalReference ?? null,
        attemptCount: input.governance.execution_attempt_count,
      },
    });
    return true;
  });
}

async function executeGovernance(workerId: string, governance: ClaimedGovernance) {
  const env = getServerEnv();
  try {
    const containment = await withTransaction((client) =>
      findActiveReleaseContainment(client, {
        organizationId: governance.organization_id,
        resource: governance.resource,
      })
    );
    if (containment) {
      const finalized = await finalizeGovernance({
        workerId,
        governance,
        status: "failed",
        summary: `Execution stopped by critical GitHub incident ${containment.id}.`,
        errorCode: "GITHUB_RELEASE_CONTAINMENT_ACTIVE",
      });
      return {
        id: governance.id,
        status: finalized ? "failed" : "skipped",
        error: `Execution stopped by critical GitHub incident ${containment.id}.`,
      };
    }
    if (!env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required.");
    const plan = resolveReleaseExecutionPlan({
      mode: "github_draft",
      action: governance.action,
      resource: governance.resource,
      context: governance.context,
      configuredRepository: env.GITHUB_REPOSITORY,
    });
    const outcome = await transitionGitHubDraftRelease({
      token: env.GITHUB_TOKEN,
      repository: plan.repository,
      tagName: plan.tagName,
      operation: governance.operation,
    });
    const finalized = await finalizeGovernance({
      workerId,
      governance,
      status: "succeeded",
      summary: outcome.summary,
      externalReference: outcome.externalReference,
    });
    return { id: governance.id, status: finalized ? "succeeded" : "skipped" };
  } catch (error) {
    const summary = safeError(error);
    const finalized = await finalizeGovernance({
      workerId,
      governance,
      status: "failed",
      summary,
      errorCode: "GITHUB_DRAFT_GOVERNANCE_FAILED",
    });
    return { id: governance.id, status: finalized ? "failed" : "skipped", error: summary };
  }
}

export async function runApprovedDraftGovernanceWorker(options: {
  governanceId?: string;
  limit?: number;
} = {}) {
  const env = getServerEnv();
  const workerId = randomUUID();
  const claimed = await claimGovernance({
    workerId,
    governanceId: options.governanceId,
    limit: Math.min(options.limit ?? env.RELEASE_EXECUTION_BATCH_SIZE, 25),
    leaseMinutes: env.RELEASE_EXECUTION_LEASE_MINUTES,
  });
  const results = [];
  for (let index = 0; index < claimed.length; index += 5) {
    results.push(...await Promise.all(
      claimed.slice(index, index + 5).map((item) => executeGovernance(workerId, item)),
    ));
  }
  return {
    claimed: claimed.length,
    succeeded: results.filter((item) => item.status === "succeeded").length,
    failed: results.filter((item) => item.status === "failed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    results,
  };
}
