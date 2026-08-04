import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";

const updateOperatorSchema = z
  .object({
    role: z.enum(["admin", "approver", "auditor"]).optional(),
    status: z.enum(["active", "disabled"]).optional(),
  })
  .refine((input) => input.role !== undefined || input.status !== undefined, {
    message: "A role or status update is required.",
  });

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ operatorId: string }> },
) {
  try {
    const actor = await getOperatorSession();
    if (!actor) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }
    if (!operatorCan(actor.role, "manage_operators")) {
      return NextResponse.json(
        { error: "Admin role required." },
        { status: 403 },
      );
    }

    const { operatorId } = await context.params;
    if (operatorId === actor.id) {
      return NextResponse.json(
        { error: "You cannot change your own role or account status." },
        { status: 409 },
      );
    }
    const input = updateOperatorSchema.parse(await request.json());

    const updated = await withTransaction(async (client) => {
      const result = await client.query<{
        id: string;
        email: string;
        display_name: string;
        role: "admin" | "approver" | "auditor";
        status: "active" | "disabled";
        password_change_required: boolean;
        last_login_at: Date | null;
        created_at: Date;
      }>(
        `
          update operators
          set role = coalesce($3, role),
              status = coalesce($4, status),
              updated_at = now()
          where id = $1
            and organization_id = $2
          returning id, email, display_name, role, status,
                    password_change_required, last_login_at, created_at
        `,
        [operatorId, actor.organizationId, input.role ?? null, input.status ?? null],
      );
      const operator = result.rows[0];
      if (!operator) return null;

      if (input.status === "disabled") {
        await client.query(
          `
            update operator_sessions
            set revoked_at = now()
            where operator_id = $1
              and revoked_at is null
          `,
          [operator.id],
        );
      }
      await appendAuditEvent(client, {
        organizationId: actor.organizationId,
        requestId: null,
        eventType: "operator.updated",
        actorType: "human",
        actorId: actor.email,
        payload: {
          operatorId: operator.id,
          email: operator.email,
          role: operator.role,
          status: operator.status,
        },
      });
      return operator;
    });

    if (!updated) {
      return NextResponse.json({ error: "Operator not found." }, { status: 404 });
    }
    return NextResponse.json({
      id: updated.id,
      email: updated.email,
      displayName: updated.display_name,
      role: updated.role,
      status: updated.status,
      mustChangePassword: updated.password_change_required,
      lastLoginAt: updated.last_login_at?.toISOString() ?? null,
      createdAt: updated.created_at.toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
