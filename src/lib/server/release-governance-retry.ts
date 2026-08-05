import "server-only";

import { appendAuditEvent } from "./audit";
import { withTransaction } from "./db";
import { ConflictError, NotFoundError } from "./errors";

export async function requeueFailedReleaseGovernance(input: {
  governanceId: string;
  organizationId: string;
  operatorEmail: string;
}) {
  return withTransaction(async (client) => {
    const result = await client.query<{
      id: string;
      action_request_id: string;
      operation: "publish" | "cancel";
      status: string;
      reviewed_by_operator_id: string | null;
      execution_attempt_count: number;
      execution_error_code: string | null;
      execution_summary: string | null;
    }>(
      `
        select id, action_request_id, operation, status,
               reviewed_by_operator_id, execution_attempt_count,
               execution_error_code, execution_summary
        from release_draft_governance_requests
        where id = $1 and organization_id = $2
        for update
      `,
      [input.governanceId, input.organizationId],
    );
    const governance = result.rows[0];
    if (!governance) throw new NotFoundError("Release governance request not found.");
    if (governance.status !== "failed" || !governance.reviewed_by_operator_id) {
      throw new ConflictError(
        "Only a failed operation with an independent approval can be retried.",
      );
    }

    await client.query(
      `
        update release_draft_governance_requests
        set status = 'approved', execution_worker_id = null,
            execution_locked_at = null, execution_started_at = null,
            execution_completed_at = null,
            execution_summary = 'Retry requested by an administrator.',
            execution_error_code = null,
            execution_external_reference = null
        where id = $1 and organization_id = $2
      `,
      [input.governanceId, input.organizationId],
    );
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: governance.action_request_id,
      eventType: `release.draft_${governance.operation}_retry_requested`,
      actorType: "human",
      actorId: input.operatorEmail,
      payload: {
        governanceRequestId: governance.id,
        operation: governance.operation,
        status: "approved",
        previousStatus: governance.status,
        previousAttemptCount: governance.execution_attempt_count,
        previousErrorCode: governance.execution_error_code,
        previousSummary: governance.execution_summary,
      },
    });
    return {
      governanceId: governance.id,
      requestId: governance.action_request_id,
      operation: governance.operation,
      status: "approved" as const,
      previousAttemptCount: governance.execution_attempt_count,
    };
  });
}
