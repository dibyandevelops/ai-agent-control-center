import { NextRequest, NextResponse } from "next/server";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
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
      const result = await client.query<{
        id: string;
        name: string;
        description: string;
        priority: number;
        effect: "allow" | "approval" | "block";
        enabled: boolean;
        conditions: { all: Array<{ field: string; operator: string; value: unknown }> };
      }>(
        `
          insert into policies (
            organization_id, name, description, priority, effect, enabled, conditions
          )
          values ($1, $2, $3, $4, $5, $6, $7::jsonb)
          returning id, name, description, priority, effect, enabled, conditions
        `,
        [
          operator.organizationId,
          input.name,
          input.description,
          input.priority,
          input.effect,
          input.enabled,
          JSON.stringify(input.conditions),
        ],
      );
      const policy = result.rows[0];
      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId: null,
        eventType: "policy.created",
        actorType: "human",
        actorId: operator.email,
        payload: {
          policyId: policy.id,
          policyName: policy.name,
          effect: policy.effect,
          enabled: policy.enabled,
          priority: policy.priority,
          conditionCount: policy.conditions.all.length,
        },
      });
      return policy;
    });
    return NextResponse.json(
      {
        id: created.id,
        name: created.name,
        description: created.description,
        scope: "Live organization",
        mode:
          created.effect === "block"
            ? "Block"
            : created.effect === "approval"
              ? "Approval"
              : "Monitor",
        effect: created.effect,
        priority: created.priority,
        conditions: created.conditions.all,
        enabled: created.enabled,
        matches: 0,
      },
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
