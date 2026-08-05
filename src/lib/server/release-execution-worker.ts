import "server-only";

import { randomUUID } from "node:crypto";
import { appendAuditEvent } from "./audit";
import { withTransaction } from "./db";
import { getServerEnv } from "./env";
import { createIdempotentGitHubDraftRelease } from "./github-draft-release";
import {
  dryRunReleaseResult,
  resolveReleaseExecutionPlan,
} from "./release-execution-core";

interface ClaimedRelease {
  id: string;
  organization_id: string;
  agent_name: string;
  action: string;
  resource: string;
  context: Record<string, unknown>;
  execution_attempt_count: number;
  reclaimed: boolean;
}

interface ExecutionResult {
  requestId: string;
  status: "succeeded" | "failed" | "skipped";
  externalReference?: string;
  error?: string;
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Release execution failed.";
  return message.slice(0, 1_000);
}

async function claimReleases(input: {
  workerId: string;
  requestId?: string;
  limit: number;
  leaseMinutes: number;
}) {
  return withTransaction(async (client) => {
    const result = await client.query<ClaimedRelease>(
      `
        with candidates as (
          select ar.id, ar.execution_status = 'executing' as reclaimed
          from action_requests ar
          where ar.decision_status = 'approved'
            and ar.action in ('deploy.release', 'github.release.create')
            and ($2::uuid is null or ar.id = $2::uuid)
            and (
              ar.execution_status = 'not_started'
              or (
                ar.execution_status = 'executing'
                and ar.execution_locked_at <=
                  now() - ($4 * interval '1 minute')
              )
            )
          order by ar.requested_at asc, ar.id asc
          for update of ar skip locked
          limit $3
        )
        update action_requests ar
        set execution_status = 'executing',
            execution_started_at = coalesce(ar.execution_started_at, now()),
            execution_completed_at = null,
            execution_worker_id = $1,
            execution_locked_at = now(),
            execution_attempt_count = ar.execution_attempt_count + 1,
            execution_summary = case
              when candidates.reclaimed then 'Automated release execution lease reclaimed.'
              else 'Automated release execution started.'
            end,
            execution_error_code = null
        from candidates, agents agent
        where ar.id = candidates.id
          and agent.id = ar.agent_id
        returning ar.id, ar.organization_id, agent.name as agent_name,
                  ar.action, ar.resource, ar.context,
                  ar.execution_attempt_count, candidates.reclaimed
      `,
      [input.workerId, input.requestId ?? null, input.limit, input.leaseMinutes],
    );

    for (const row of result.rows) {
      await appendAuditEvent(client, {
        organizationId: row.organization_id,
        requestId: row.id,
        eventType: row.reclaimed
          ? "action.execution_reclaimed"
          : "action.execution_executing",
        actorType: "system",
        actorId: "release-execution-worker",
        payload: {
          status: "executing",
          action: row.action,
          resource: row.resource,
          attemptCount: row.execution_attempt_count,
        },
      });
    }
    return result.rows;
  });
}

async function finalizeRelease(input: {
  workerId: string;
  release: ClaimedRelease;
  status: "succeeded" | "failed";
  summary: string;
  externalReference?: string;
  errorCode?: string;
}) {
  return withTransaction(async (client) => {
    const result = await client.query<{
      id: string;
      organization_id: string;
    }>(
      `
        update action_requests
        set execution_status = $3,
            execution_completed_at = now(),
            execution_external_reference = $4,
            execution_summary = $5,
            execution_error_code = $6,
            execution_worker_id = null,
            execution_locked_at = null
        where id = $1
          and execution_worker_id = $2
          and execution_status = 'executing'
        returning id, organization_id
      `,
      [
        input.release.id,
        input.workerId,
        input.status,
        input.externalReference ?? null,
        input.summary,
        input.errorCode ?? null,
      ],
    );
    const updated = result.rows[0];
    if (!updated) return false;
    await appendAuditEvent(client, {
      organizationId: updated.organization_id,
      requestId: updated.id,
      eventType: `action.execution_${input.status}`,
      actorType: "system",
      actorId: "release-execution-worker",
      payload: {
        status: input.status,
        action: input.release.action,
        resource: input.release.resource,
        summary: input.summary,
        externalReference: input.externalReference ?? null,
        errorCode: input.errorCode ?? null,
        attemptCount: input.release.execution_attempt_count,
      },
    });
    return true;
  });
}

async function executeClaimedRelease(
  workerId: string,
  release: ClaimedRelease,
): Promise<ExecutionResult> {
  const env = getServerEnv();
  try {
    const plan = resolveReleaseExecutionPlan({
      mode: env.RELEASE_EXECUTION_MODE === "github_draft"
        ? "github_draft"
        : "dry_run",
      action: release.action,
      resource: release.resource,
      context: release.context,
      configuredRepository: env.GITHUB_REPOSITORY,
    });
    if (plan.mode === "github_draft" && !env.GITHUB_TOKEN) {
      throw new Error("GITHUB_TOKEN is required for GitHub draft execution.");
    }
    const outcome = plan.mode === "github_draft"
      ? await createIdempotentGitHubDraftRelease({
          token: env.GITHUB_TOKEN ?? "",
          repository: plan.repository,
          tagName: plan.tagName,
          targetCommitish: plan.targetCommitish,
          changeTicket: plan.changeTicket,
        })
      : dryRunReleaseResult(plan);
    const finalized = await finalizeRelease({
      workerId,
      release,
      status: "succeeded",
      summary: outcome.summary,
      externalReference: outcome.externalReference,
    });
    return finalized
      ? {
          requestId: release.id,
          status: "succeeded",
          externalReference: outcome.externalReference,
        }
      : { requestId: release.id, status: "skipped" };
  } catch (error) {
    const reason = safeError(error);
    const finalized = await finalizeRelease({
      workerId,
      release,
      status: "failed",
      summary: reason,
      errorCode: "AUTOMATED_RELEASE_EXECUTION_FAILED",
    });
    return finalized
      ? { requestId: release.id, status: "failed", error: reason }
      : { requestId: release.id, status: "skipped" };
  }
}

export async function runApprovedReleaseWorker(options: {
  requestId?: string;
  limit?: number;
} = {}) {
  const env = getServerEnv();
  if (env.RELEASE_EXECUTION_MODE === "disabled") {
    return { mode: "disabled" as const, claimed: 0, succeeded: 0, failed: 0, skipped: 0, results: [] };
  }
  const workerId = randomUUID();
  const releases = await claimReleases({
    workerId,
    requestId: options.requestId,
    limit: Math.min(options.limit ?? env.RELEASE_EXECUTION_BATCH_SIZE, 25),
    leaseMinutes: env.RELEASE_EXECUTION_LEASE_MINUTES,
  });
  const results: ExecutionResult[] = [];
  for (let index = 0; index < releases.length; index += 5) {
    results.push(
      ...(await Promise.all(
        releases.slice(index, index + 5).map((release) =>
          executeClaimedRelease(workerId, release)),
      )),
    );
  }
  return {
    mode: env.RELEASE_EXECUTION_MODE,
    claimed: releases.length,
    succeeded: results.filter((result) => result.status === "succeeded").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length,
    results,
  };
}
