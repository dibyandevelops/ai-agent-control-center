import { NextRequest, NextResponse } from "next/server";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { operatorCan } from "@/lib/server/operator-roles";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { policyWriteSchema } from "@/lib/server/policy-input";

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
    const result = await withTransaction(async (client) => {
      const updateResult = await client.query<{
        id: string;
        organization_id: string;
        name: string;
        description: string;
        priority: number;
        effect: "allow" | "approval" | "block";
        enabled: boolean;
        conditions: { all: Array<{ field: string; operator: string; value: unknown }> };
      }>(
        `
          update policies
          set name = coalesce($2, name),
              description = coalesce($3, description),
              priority = coalesce($4, priority),
              effect = coalesce($5, effect),
              enabled = coalesce($6, enabled),
              conditions = coalesce($7::jsonb, conditions),
              updated_at = now()
          where id = $1
            and organization_id = $8
          returning id, organization_id, name, description, priority,
                    effect, enabled, conditions
        `,
        [
          policyId,
          input.name ?? null,
          input.description ?? null,
          input.priority ?? null,
          input.effect ?? null,
          input.enabled ?? null,
          input.conditions ? JSON.stringify(input.conditions) : null,
          operator.organizationId,
        ],
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
          changedFields: Object.keys(input).sort(),
          effect: policy.effect,
          priority: policy.priority,
          enabled: policy.enabled,
        },
      });
      return policy;
    });

    if (!result) {
      return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    }
    return NextResponse.json({
      id: result.id,
      name: result.name,
      description: result.description,
      scope: "Live organization",
      mode:
        result.effect === "block"
          ? "Block"
          : result.effect === "approval"
            ? "Approval"
            : "Monitor",
      effect: result.effect,
      priority: result.priority,
      conditions: result.conditions.all,
      enabled: result.enabled,
    });
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
