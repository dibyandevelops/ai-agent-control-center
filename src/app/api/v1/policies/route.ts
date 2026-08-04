import { NextRequest, NextResponse } from "next/server";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import {
  createActivationRequest,
  insertPolicyVersion,
  policyResponse,
  type LockedPolicy,
} from "@/lib/server/policy-governance";
import { policyWriteSchema } from "@/lib/server/policy-input";

export async function POST(request: NextRequest) {
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
    const input = policyWriteSchema.parse(await request.json());
    const created = await withTransaction(async (client) => {
      const policyResult = await client.query<LockedPolicy>(
        `
          insert into policies (
            organization_id, name, description, priority, effect, enabled, conditions
          )
          values ($1, $2, $3, $4, $5, false, $6::jsonb)
          returning id, organization_id, enabled, active_version_id
        `,
        [
          operator.organizationId,
          input.name,
          input.description,
          input.priority,
          input.effect,
          JSON.stringify(input.conditions),
        ],
      );
      const policy = policyResult.rows[0];
      const version = await insertPolicyVersion(client, {
        policy,
        configuration: input,
        operator,
        changeType: "created",
      });
      const activationRequest = input.enabled
        ? await createActivationRequest(client, { policy, version, operator })
        : null;

      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId: null,
        eventType: "policy.version_created",
        actorType: "human",
        actorId: operator.email,
        payload: {
          policyId: policy.id,
          policyName: version.name,
          versionId: version.id,
          versionNumber: version.version_number,
          changeType: version.change_type,
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
            policyId: policy.id,
            policyName: version.name,
            versionId: version.id,
            versionNumber: version.version_number,
            activationRequestId: activationRequest.id,
          },
        });
      }
      return { policy, version, activationRequest };
    });

    return NextResponse.json(
      policyResponse({
        policyId: created.policy.id,
        version: created.version,
        enabled: false,
        activeVersionNumber: null,
        activationRequest: created.activationRequest,
      }),
      { status: 201 },
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
