import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool, withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { appendAuditEvent } from "@/lib/server/audit";
import { operatorCan } from "@/lib/server/operator-roles";

const orgSettingsSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
});

export async function GET() {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }

    const result = await getPool().query<{
      id: string;
      name: string;
      plan_code: string;
      created_at: string;
    }>(
      `select id, name, plan_code, created_at
         from organizations
        where id = $1`,
      [operator.organizationId],
    );

    const org = result.rows[0];
    if (!org) {
      return NextResponse.json({ error: "Organization not found." }, { status: 404 });
    }

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        planCode: org.plan_code,
        createdAt: org.created_at,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }

    if (!operatorCan(operator.role, "manage_operators")) {
      return NextResponse.json({ error: "Admin permissions required." }, { status: 403 });
    }

    const input = orgSettingsSchema.parse(await request.json());

    if (input.name) {
      await withTransaction(async (client) => {
        await client.query(
          `update organizations
              set name = $1, updated_at = now()
            where id = $2`,
          [input.name, operator.organizationId],
        );

        await appendAuditEvent(client, {
          organizationId: operator.organizationId,
          requestId: null,
          eventType: "organization.updated",
          actorType: "human",
          actorId: operator.email,
          payload: {
            previousName: operator.organizationName,
            newName: input.name,
          },
        });
      });
    }

    return NextResponse.json({
      success: true,
      name: input.name || operator.organizationName,
    });
  } catch (error) {
    return apiError(error);
  }
}
