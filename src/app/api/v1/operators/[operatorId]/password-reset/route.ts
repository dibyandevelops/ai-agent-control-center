import { NextResponse } from "next/server";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import {
  generateTemporaryPassword,
  hashPassword,
} from "@/lib/server/password";

export async function POST(
  _request: Request,
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
        { error: "Use your profile to change your own password." },
        { status: 409 },
      );
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const reset = await withTransaction(async (client) => {
      const result = await client.query<{
        id: string;
        email: string;
        display_name: string;
        role: "admin" | "approver" | "auditor";
        status: "active" | "disabled";
        password_change_required: boolean;
        locked_until: Date | null;
        last_login_at: Date | null;
        created_at: Date;
      }>(
        `
          update operators
          set password_hash = $3,
              password_change_required = true,
              failed_login_count = 0,
              failed_login_window_started_at = null,
              locked_until = null,
              updated_at = now()
          where id = $1
            and organization_id = $2
          returning id, email, display_name, role, status,
                    password_change_required, locked_until, last_login_at, created_at
        `,
        [operatorId, actor.organizationId, passwordHash],
      );
      const operator = result.rows[0];
      if (!operator) return null;

      await client.query(
        `
          update operator_sessions
          set revoked_at = now()
          where operator_id = $1
            and revoked_at is null
        `,
        [operator.id],
      );
      await appendAuditEvent(client, {
        organizationId: actor.organizationId,
        requestId: null,
        eventType: "operator.password_reset",
        actorType: "human",
        actorId: actor.email,
        payload: {
          operatorId: operator.id,
          email: operator.email,
          sessionsRevoked: true,
          passwordChangeRequired: true,
        },
      });
      return operator;
    });

    if (!reset) {
      return NextResponse.json({ error: "Operator not found." }, { status: 404 });
    }
    return NextResponse.json(
      {
        operator: {
          id: reset.id,
          email: reset.email,
          displayName: reset.display_name,
          role: reset.role,
          status: reset.status,
          mustChangePassword: reset.password_change_required,
          lockedUntil: reset.locked_until?.toISOString() ?? null,
          lastLoginAt: reset.last_login_at?.toISOString() ?? null,
          createdAt: reset.created_at.toISOString(),
        },
        temporaryPassword,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          Pragma: "no-cache",
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
