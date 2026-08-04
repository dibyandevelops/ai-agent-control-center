import { NextRequest, NextResponse } from "next/server";
import { ConflictError, NotFoundError } from "@/lib/server/errors";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import type { PolicyConditions } from "@/lib/server/contracts";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { canReviewPolicyActivation } from "@/lib/server/policy-governance";
import { policyActivationDecisionSchema } from "@/lib/server/policy-input";

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
    if (!operatorCan(operator.role, "manage_policies")) {
      return NextResponse.json(
        { error: "Admin role required." },
        { status: 403 },
      );
    }
    const { requestId } = await context.params;
    const input = policyActivationDecisionSchema.parse(await request.json());

    const result = await withTransaction(async (client) => {
      const requestResult = await client.query<{
        id: string;
        status: "pending" | "approved" | "rejected";
        policy_id: string;
        version_id: string;
        requested_by_operator_id: string | null;
        requested_by_email: string;
        organization_id: string;
        active_version_id: string | null;
        version_number: number;
        name: string;
        description: string;
        priority: number;
        effect: "allow" | "approval" | "block";
        conditions: PolicyConditions;
      }>(
        `
          select
            par.id,
            par.status,
            par.policy_id,
            par.version_id,
            par.requested_by_operator_id,
            par.requested_by_email,
            par.organization_id,
            p.active_version_id,
            pv.version_number,
            pv.name,
            pv.description,
            pv.priority,
            pv.effect,
            pv.conditions
          from policy_activation_requests par
          join policies p on p.id = par.policy_id
          join policy_versions pv on pv.id = par.version_id
          where par.id = $1 and par.organization_id = $2
          for update of par, p
        `,
        [requestId, operator.organizationId],
      );
      const activation = requestResult.rows[0];
      if (!activation) {
        throw new NotFoundError("Policy activation request not found.");
      }
      if (activation.status !== "pending") {
        throw new ConflictError("This activation request was already reviewed.");
      }
      if (!canReviewPolicyActivation(
        {
          requestedByOperatorId: activation.requested_by_operator_id,
          requestedByEmail: activation.requested_by_email,
        },
        operator,
      )) {
        throw new ConflictError(
          "A different administrator must review this activation.",
        );
      }

      await client.query(
        `
          update policy_activation_requests
          set status = $2,
              reviewed_by_operator_id = $3,
              reviewed_by_email = $4,
              review_reason = $5,
              reviewed_at = now()
          where id = $1 and status = 'pending'
        `,
        [requestId, input.decision, operator.id, operator.email, input.reason],
      );

      if (input.decision === "approved") {
        await client.query(
          `
            update policies
            set name = $2,
                description = $3,
                priority = $4,
                effect = $5,
                conditions = $6::jsonb,
                enabled = true,
                active_version_id = $7,
                updated_at = now()
            where id = $1 and organization_id = $8
          `,
          [
            activation.policy_id,
            activation.name,
            activation.description,
            activation.priority,
            activation.effect,
            JSON.stringify(activation.conditions),
            activation.version_id,
            operator.organizationId,
          ],
        );
      }

      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId: null,
        eventType:
          input.decision === "approved"
            ? "policy.activation_approved"
            : "policy.activation_rejected",
        actorType: "human",
        actorId: operator.email,
        payload: {
          activationRequestId: activation.id,
          policyId: activation.policy_id,
          policyName: activation.name,
          versionId: activation.version_id,
          versionNumber: activation.version_number,
          requestedBy: activation.requested_by_email,
          reviewedBy: operator.email,
          reason: input.reason,
          previousActiveVersionId: activation.active_version_id,
        },
      });

      return {
        id: activation.id,
        policyId: activation.policy_id,
        versionId: activation.version_id,
        versionNumber: activation.version_number,
        policyName: activation.name,
        status: input.decision,
        reviewedBy: operator.email,
        reason: input.reason,
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        { error: "Another policy already uses this name." },
        { status: 409 },
      );
    }
    return apiError(error);
  }
}
