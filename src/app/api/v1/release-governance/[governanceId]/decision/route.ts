import { after, NextRequest, NextResponse } from "next/server";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { releaseGovernanceDecisionSchema } from "@/lib/server/contracts";
import { withTransaction } from "@/lib/server/db";
import { ConflictError, NotFoundError } from "@/lib/server/errors";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { canReviewReleaseGovernance } from "@/lib/server/release-governance";
import { runApprovedDraftGovernanceWorker } from "@/lib/server/release-governance-worker";
import {
  findActiveReleaseContainment,
  releaseContainmentMessage,
} from "@/lib/server/github-release-containment";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ governanceId: string }> },
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
    const { governanceId } = await context.params;
    const input = releaseGovernanceDecisionSchema.parse(await request.json());
    const result = await withTransaction(async (client) => {
      const requestResult = await client.query<{
        id: string;
        action_request_id: string;
        operation: "publish" | "cancel";
        resource: string;
        status: string;
        requested_by_operator_id: string;
        requested_by_email: string;
        expires_at: Date;
      }>(
        `
          select governance.id, governance.action_request_id,
                 governance.operation, governance.status, action.resource,
                 governance.requested_by_operator_id,
                 governance.requested_by_email, governance.expires_at
          from release_draft_governance_requests governance
          join action_requests action on action.id = governance.action_request_id
          where governance.id = $1 and governance.organization_id = $2
          for update of governance
        `,
        [governanceId, operator.organizationId],
      );
      const governance = requestResult.rows[0];
      if (!governance) throw new NotFoundError("Release governance request not found.");
      if (governance.status !== "pending") {
        throw new ConflictError("This release governance request was already reviewed.");
      }
      if (governance.expires_at.getTime() <= Date.now()) {
        await client.query(
          `
            update release_draft_governance_requests
            set status = 'expired', reviewed_at = now(),
                review_reason = 'Governance request expired before independent review.'
            where id = $1
          `,
          [governanceId],
        );
        await appendAuditEvent(client, {
          organizationId: operator.organizationId,
          requestId: governance.action_request_id,
          eventType: "release.draft_governance_expired",
          actorType: "system",
          actorId: "release-governance-deadline",
          payload: { governanceRequestId: governance.id, status: "expired" },
        });
        return {
          expired: true as const,
          id: governance.id,
          requestId: governance.action_request_id,
          operation: governance.operation,
          status: "expired" as const,
        };
      }
      if (!canReviewReleaseGovernance({
        requestedByOperatorId: governance.requested_by_operator_id,
        requestedByEmail: governance.requested_by_email,
      }, operator)) {
        throw new ConflictError(
          "A different administrator must review this release operation.",
        );
      }
      if (input.decision === "approved") {
        const containment = await findActiveReleaseContainment(client, {
          organizationId: operator.organizationId,
          resource: governance.resource,
        });
        if (containment) {
          throw new ConflictError(releaseContainmentMessage(containment.id));
        }
      }

      await client.query(
        `
          update release_draft_governance_requests
          set status = $2, reviewed_by_operator_id = $3,
              reviewed_by_email = $4, review_reason = $5, reviewed_at = now()
          where id = $1 and status = 'pending'
        `,
        [governanceId, input.decision, operator.id, operator.email, input.reason],
      );
      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId: governance.action_request_id,
        eventType: `release.draft_${governance.operation}_${input.decision}`,
        actorType: "human",
        actorId: operator.email,
        payload: {
          governanceRequestId: governance.id,
          operation: governance.operation,
          status: input.decision,
          requestedBy: governance.requested_by_email,
          reviewedBy: operator.email,
          reason: input.reason,
        },
      });
      return {
        expired: false as const,
        id: governance.id,
        requestId: governance.action_request_id,
        operation: governance.operation,
        status: input.decision,
      };
    });
    if (result.expired) {
      return NextResponse.json(
        { error: "This governance request expired." },
        { status: 409 },
      );
    }
    if (result.status === "approved") {
      after(async () => {
        try {
          await runApprovedDraftGovernanceWorker({ governanceId, limit: 1 });
        } catch (error) {
          console.error("Approved GitHub draft operation failed to start", error);
        }
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
