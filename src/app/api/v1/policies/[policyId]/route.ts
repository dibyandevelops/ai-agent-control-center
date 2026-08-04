import { after, NextRequest, NextResponse } from "next/server";
import { ConflictError } from "@/lib/server/errors";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { getPolicyActivationSchedule } from "@/lib/server/policy-activation-schedule";
import {
  createActivationRequest,
  ensureNoPendingActivation,
  insertPolicyVersion,
  loadLatestPolicyVersion,
  lockPolicy,
  policyResponse,
} from "@/lib/server/policy-governance";
import { policyWriteSchema } from "@/lib/server/policy-input";
import { notifySlackOfPolicyActivation } from "@/lib/server/slack";

const updatePolicySchema = policyWriteSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  { message: "At least one policy field is required." },
);

export async function PATCH(
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
    const input = updatePolicySchema.parse(await request.json());
    const inputFields = Object.keys(input);
    const toggleOnly = inputFields.length === 1 && inputFields[0] === "enabled";

    const result = await withTransaction(async (client) => {
      const policy = await lockPolicy(
        client,
        policyId,
        operator.organizationId,
      );
      const auditExpiredActivation = (expired: {
        id: string;
        version_id: string;
        expires_at: Date;
      }) =>
        appendAuditEvent(client, {
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
          },
        });
      const latestVersion = await loadLatestPolicyVersion(
        client,
        policyId,
        operator.organizationId,
      );
      const activeVersionResult = policy.active_version_id
        ? await client.query<{ version_number: number }>(
            "select version_number from policy_versions where id = $1",
            [policy.active_version_id],
          )
        : null;
      const activeVersionNumber =
        activeVersionResult?.rows[0]?.version_number ?? null;

      if (toggleOnly) {
        if (input.enabled) {
          if (
            policy.enabled &&
            policy.active_version_id === latestVersion.id
          ) {
            throw new ConflictError("This policy version is already active.");
          }
          const activationRequest = await createActivationRequest(client, {
            policy,
            version: latestVersion,
            operator,
            schedule: getPolicyActivationSchedule(),
            onExpired: auditExpiredActivation,
          });
          await appendAuditEvent(client, {
            organizationId: operator.organizationId,
            requestId: null,
            eventType: "policy.activation_requested",
            actorType: "human",
            actorId: operator.email,
            payload: {
              policyId,
              policyName: latestVersion.name,
              versionId: latestVersion.id,
              versionNumber: latestVersion.version_number,
              activationRequestId: activationRequest.id,
            },
          });
          return {
            policy,
            version: latestVersion,
            activeVersionNumber,
            activationRequest,
          };
        }

        await client.query(
          `
            update policies
            set enabled = false, updated_at = now()
            where id = $1 and organization_id = $2
          `,
          [policyId, operator.organizationId],
        );
        await appendAuditEvent(client, {
          organizationId: operator.organizationId,
          requestId: null,
          eventType: "policy.disabled",
          actorType: "human",
          actorId: operator.email,
          payload: {
            policyId,
            policyName: latestVersion.name,
            activeVersionId: policy.active_version_id,
          },
        });
        return {
          policy: { ...policy, enabled: false },
          version: latestVersion,
          activeVersionNumber,
          activationRequest: null,
        };
      }

      await ensureNoPendingActivation(client, policyId, auditExpiredActivation);
      const merged = policyWriteSchema.parse({
        name: input.name ?? latestVersion.name,
        description: input.description ?? latestVersion.description,
        priority: input.priority ?? latestVersion.priority,
        effect: input.effect ?? latestVersion.effect,
        conditions: input.conditions ?? latestVersion.conditions,
        enabled: input.enabled ?? false,
      });
      const version = await insertPolicyVersion(client, {
        policy,
        configuration: merged,
        operator,
        changeType: "edited",
      });

      if (!policy.enabled) {
        await client.query(
          `
            update policies
            set name = $2,
                description = $3,
                priority = $4,
                effect = $5,
                conditions = $6::jsonb,
                updated_at = now()
            where id = $1 and organization_id = $7
          `,
          [
            policyId,
            version.name,
            version.description,
            version.priority,
            version.effect,
            JSON.stringify(version.conditions),
            operator.organizationId,
          ],
        );
      }
      const activationRequest = merged.enabled
        ? await createActivationRequest(client, {
            policy,
            version,
            operator,
            schedule: getPolicyActivationSchedule(),
            onExpired: auditExpiredActivation,
          })
        : null;

      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId: null,
        eventType: "policy.version_created",
        actorType: "human",
        actorId: operator.email,
        payload: {
          policyId,
          policyName: version.name,
          versionId: version.id,
          versionNumber: version.version_number,
          changeType: version.change_type,
          basedOnVersionId: latestVersion.id,
        },
      });
      if (activationRequest) {
        await appendAuditEvent(client, {
          organizationId: operator.organizationId,
          requestId: null,
          eventType: "policy.activation_requested",
          actorType: "human",
          actorId: operator.email,
          payload: {
            policyId,
            policyName: version.name,
            versionId: version.id,
            versionNumber: version.version_number,
            activationRequestId: activationRequest.id,
          },
        });
      }
      return {
        policy,
        version,
        activeVersionNumber,
        activationRequest,
      };
    });

    if (result.activationRequest) {
      after(async () => {
        await notifySlackOfPolicyActivation({
          kind: "requested",
          requestId: result.activationRequest!.id,
          policyName: result.version.name,
          versionNumber: result.version.version_number,
          requestedBy: operator.email,
          expiresAt: result.activationRequest!.expires_at.toISOString(),
        }).catch((error) => {
          console.error("Slack policy activation notification failed", error);
        });
      });
    }

    return NextResponse.json(
      policyResponse({
        policyId,
        version: result.version,
        enabled: result.policy.enabled,
        activeVersionNumber: result.activeVersionNumber,
        activationRequest: result.activationRequest,
      }),
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        { error: "A policy with this name already exists." },
        { status: 409 },
      );
    }
    return apiError(error);
  }
}
