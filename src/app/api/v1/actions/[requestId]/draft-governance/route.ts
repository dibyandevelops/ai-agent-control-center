import { NextRequest, NextResponse } from "next/server";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { releaseGovernanceRequestSchema } from "@/lib/server/contracts";
import { withTransaction } from "@/lib/server/db";
import { ConflictError, NotFoundError } from "@/lib/server/errors";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { enqueueReleaseGovernanceNotification } from "@/lib/server/notification-outbox";
import {
  findActiveReleaseContainment,
  releaseContainmentMessage,
} from "@/lib/server/github-release-containment";
import { releaseGovernanceLabel } from "@/lib/server/release-governance";
import { resolveReleaseExecutionPlan } from "@/lib/server/release-execution-core";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }
    if (!operatorCan(operator.role, "govern_releases")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    const { requestId } = await context.params;
    const input = releaseGovernanceRequestSchema.parse(await request.json());
    const result = await withTransaction(async (client) => {
      const actionResult = await client.query<{
        id: string;
        action: string;
        resource: string;
        context: Record<string, unknown>;
        decision_status: string;
        execution_status: string;
        execution_external_reference: string | null;
      }>(
        `
          select id, action, resource, context, decision_status,
                 execution_status, execution_external_reference
          from action_requests
          where id = $1 and organization_id = $2
          for update
        `,
        [requestId, operator.organizationId],
      );
      const action = actionResult.rows[0];
      if (!action) throw new NotFoundError("Release request not found.");
      if (
        action.decision_status !== "approved" ||
        action.execution_status !== "succeeded" ||
        !action.execution_external_reference?.startsWith("https://github.com/")
      ) {
        throw new ConflictError(
          "Only a successfully created GitHub draft can enter publication governance.",
        );
      }
      try {
        resolveReleaseExecutionPlan({
          mode: "github_draft",
          action: action.action,
          resource: action.resource,
          context: action.context,
        });
      } catch (error) {
        throw new ConflictError(
          error instanceof Error
            ? error.message
            : "The GitHub draft target is not eligible for governance.",
        );
      }

      const containment = await findActiveReleaseContainment(client, {
        organizationId: operator.organizationId,
        resource: action.resource,
      });
      if (containment) {
        throw new ConflictError(releaseContainmentMessage(containment.id));
      }

      const terminal = await client.query<{ operation: string }>(
        `
          select operation
          from release_draft_governance_requests
          where action_request_id = $1 and status = 'succeeded'
          limit 1
        `,
        [requestId],
      );
      if (terminal.rows[0]) {
        throw new ConflictError(
          `This draft already completed ${releaseGovernanceLabel(terminal.rows[0].operation as "publish" | "cancel")}.`,
        );
      }

      const created = await client.query<{
        id: string;
        operation: "publish" | "cancel";
        status: "pending";
        requested_at: Date;
        expires_at: Date;
      }>(
        `
          insert into release_draft_governance_requests (
            organization_id, action_request_id, operation, request_reason,
            requested_by_operator_id, requested_by_email
          )
          values ($1, $2, $3, $4, $5, $6)
          returning id, operation, status, requested_at, expires_at
        `,
        [
          operator.organizationId,
          requestId,
          input.operation,
          input.reason,
          operator.id,
          operator.email,
        ],
      );
      const governance = created.rows[0];
      const notification = await enqueueReleaseGovernanceNotification(client, {
        organizationId: operator.organizationId,
        payload: {
          governanceId: governance.id,
          requestId,
          operation: input.operation,
          resource: action.resource,
          requestedBy: operator.email,
          expiresAt: governance.expires_at.toISOString(),
        },
      });
      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId,
        eventType: `release.draft_${input.operation}_requested`,
        actorType: "human",
        actorId: operator.email,
        payload: {
          governanceRequestId: governance.id,
          operation: input.operation,
          status: governance.status,
          reason: input.reason,
          requestedBy: operator.email,
          expiresAt: governance.expires_at.toISOString(),
          notificationOutboxId: notification.id,
        },
      });
      return governance;
    });
    return NextResponse.json({
      id: result.id,
      operation: result.operation,
      status: result.status,
      requestedAt: result.requested_at.toISOString(),
      expiresAt: result.expires_at.toISOString(),
    }, { status: 201 });
  } catch (error) {
    if (
      error && typeof error === "object" && "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        { error: "This draft already has a governance request awaiting completion." },
        { status: 409 },
      );
    }
    return apiError(error);
  }
}
