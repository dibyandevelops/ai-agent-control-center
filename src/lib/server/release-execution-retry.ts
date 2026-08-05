import "server-only";

import { appendAuditEvent } from "./audit";
import { withTransaction } from "./db";
import { ConflictError, NotFoundError } from "./errors";

export async function requeueFailedReleaseExecution(input: {
  requestId: string;
  organizationId: string;
  operatorEmail: string;
}) {
  return withTransaction(async (client) => {
    const request = await client.query<{
      id: string;
      action: string;
      execution_attempt_count: number;
      execution_error_code: string | null;
      execution_summary: string | null;
      decision_status: string;
      execution_status: string;
    }>(
      `
        select id, action, execution_attempt_count, execution_error_code,
               execution_summary, decision_status, execution_status
        from action_requests
        where id = $1 and organization_id = $2
        for update
      `,
      [input.requestId, input.organizationId],
    );
    const row = request.rows[0];
    if (!row) throw new NotFoundError("Request not found.");
    if (
      row.decision_status !== "approved" ||
      row.execution_status !== "failed" ||
      !["deploy.release", "github.release.create"].includes(row.action)
    ) {
      throw new ConflictError(
        "Only failed, approved release executions can be retried.",
      );
    }

    await client.query(
      `
        update action_requests
        set execution_status = 'not_started',
            execution_started_at = null,
            execution_completed_at = null,
            execution_external_reference = null,
            execution_summary = 'Retry requested by an administrator.',
            execution_error_code = null,
            execution_worker_id = null,
            execution_locked_at = null
        where id = $1 and organization_id = $2
      `,
      [input.requestId, input.organizationId],
    );
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: input.requestId,
      eventType: "action.execution_retry_requested",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: {
        status: "not_started",
        previousStatus: row.execution_status,
        previousAttemptCount: row.execution_attempt_count,
        previousErrorCode: row.execution_error_code,
        previousSummary: row.execution_summary,
      },
    });
    return {
      requestId: input.requestId,
      status: "not_started" as const,
      previousAttemptCount: row.execution_attempt_count,
    };
  });
}
