import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { operatorCan } from "@/lib/server/operator-roles";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";

const updatePolicySchema = z.object({
  enabled: z.boolean(),
});

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
    const result = await withTransaction(async (client) => {
      const updateResult = await client.query<{
        id: string;
        organization_id: string;
        name: string;
        enabled: boolean;
      }>(
        `
          update policies
          set enabled = $2, updated_at = now()
          where id = $1
            and organization_id = $3
          returning id, organization_id, name, enabled
        `,
        [policyId, input.enabled, operator.organizationId],
      );
      const policy = updateResult.rows[0];
      if (!policy) return null;

      await appendAuditEvent(client, {
        organizationId: policy.organization_id,
        requestId: null,
        eventType: "policy.updated",
        actorType: "human",
        actorId: operator.email,
        payload: {
          policyId: policy.id,
          policyName: policy.name,
          enabled: policy.enabled,
        },
      });
      return policy;
    });

    if (!result) {
      return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
