import { NextRequest, NextResponse } from "next/server";
import { ConflictError, NotFoundError } from "@/lib/server/errors";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { enqueuePolicyActivationNotification } from "@/lib/server/notification-outbox";
import { getPolicyActivationSchedule } from "@/lib/server/policy-activation-schedule";
import {
  createActivationRequest,
  ensureNoPendingActivation,
  insertPolicyVersion,
  lockPolicy,
  type ExpiredPolicyActivation,
  type PolicyVersionRow,
} from "@/lib/server/policy-governance";
import { policyRollbackSchema } from "@/lib/server/policy-input";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ policyId: string }> },
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
    const { policyId } = await context.params;
    const input = policyRollbackSchema.parse(await request.json());

    const result = await withTransaction(async (client) => {
      const policy = await lockPolicy(
        client,
        policyId,
        operator.organizationId,
      );
      const auditExpiredActivation = async (
        expired: ExpiredPolicyActivation,
      ) => {
        const outbox = await enqueuePolicyActivationNotification(client, {
          organizationId: operator.organizationId,
          sequence: 0,
          payload: {
            kind: "expired",
            requestId: expired.id,
            policyId,
            policyName: expired.policy_name,
            versionId: expired.version_id,
            versionNumber: expired.version_number,
            requestedBy: expired.requested_by_email,
            expiresAt: expired.expires_at.toISOString(),
            reminderCount: 0,
          },
        });
        await appendAuditEvent(client, {
          organizationId: operator.organizationId,
          requestId: null,
          eventType: "policy.activation_expired",
          actorType: "system",
          actorId: "policy-deadline",
          payload: {
            activationRequestId: expired.id,
            policyId,
            versionId: expired.version_id,
            expiredAt: expired.expires_at.toISOString(),
            notificationOutboxId: outbox.id,
          },
        });
      };
      if (policy.active_version_id === input.versionId) {
        throw new ConflictError("That policy version is already active.");
      }
      await ensureNoPendingActivation(client, policyId, auditExpiredActivation);
      const sourceResult = await client.query<PolicyVersionRow>(
        `
          select *
          from policy_versions
          where id = $1 and policy_id = $2 and organization_id = $3
        `,
        [input.versionId, policyId, operator.organizationId],
      );
      const source = sourceResult.rows[0];
      if (!source) throw new NotFoundError("Rollback version not found.");

      const version = await insertPolicyVersion(client, {
        policy,
        configuration: source,
        operator,
        changeType: "rollback",
        sourceVersionId: source.id,
      });
      const activationRequest = await createActivationRequest(client, {
        policy,
        version,
        operator,
        schedule: getPolicyActivationSchedule(),
        onExpired: auditExpiredActivation,
      });
      const outbox = await enqueuePolicyActivationNotification(client, {
        organizationId: operator.organizationId,
        sequence: 0,
        payload: {
          kind: "requested",
          requestId: activationRequest.id,
          policyId,
          policyName: version.name,
          versionId: version.id,
          versionNumber: version.version_number,
          requestedBy: operator.email,
          expiresAt: activationRequest.expires_at.toISOString(),
          reminderCount: 0,
        },
      });
      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId: null,
        eventType: "policy.rollback_requested",
        actorType: "human",
        actorId: operator.email,
        payload: {
          policyId,
          policyName: version.name,
          sourceVersionId: source.id,
          sourceVersionNumber: source.version_number,
          rollbackVersionId: version.id,
          rollbackVersionNumber: version.version_number,
          activationRequestId: activationRequest.id,
          notificationOutboxId: outbox.id,
        },
      });
      return {
        policyId,
        policyName: version.name,
        versionId: version.id,
        versionNumber: version.version_number,
        sourceVersionId: source.id,
        sourceVersionNumber: source.version_number,
        activationRequestId: activationRequest.id,
        status: activationRequest.status,
        expiresAt: activationRequest.expires_at.toISOString(),
      };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
