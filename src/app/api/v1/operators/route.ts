import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { hashPassword } from "@/lib/server/password";

const createOperatorSchema = z.object({
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  displayName: z.string().trim().min(2).max(120),
  role: z.enum(["admin", "approver", "auditor"]),
  password: z.string().min(12).max(256),
});

async function requireAdmin() {
  const operator = await getOperatorSession();
  if (!operator) return { operator: null, response: NextResponse.json(
    { error: "Operator authentication required." },
    { status: 401 },
  ) };
  if (!operatorCan(operator.role, "manage_operators")) {
    return { operator: null, response: NextResponse.json(
      { error: "Admin role required." },
      { status: 403 },
    ) };
  }
  return { operator, response: null };
}

export async function GET() {
  try {
    const authorization = await requireAdmin();
    if (!authorization.operator) return authorization.response;
    const operators = await withTransaction(async (client) => {
      const result = await client.query<{
        id: string;
        email: string;
        display_name: string;
        role: "admin" | "approver" | "auditor";
        status: "active" | "disabled";
        last_login_at: Date | null;
        created_at: Date;
      }>(
        `
          select id, email, display_name, role, status, last_login_at, created_at
          from operators
          where organization_id = $1
          order by created_at asc
        `,
        [authorization.operator.organizationId],
      );
      return result.rows;
    });
    return NextResponse.json({
      operators: operators.map((operator) => ({
        id: operator.id,
        email: operator.email,
        displayName: operator.display_name,
        role: operator.role,
        status: operator.status,
        lastLoginAt: operator.last_login_at?.toISOString() ?? null,
        createdAt: operator.created_at.toISOString(),
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.operator) return authorization.response;
    const input = createOperatorSchema.parse(await request.json());
    const passwordHash = await hashPassword(input.password);

    const created = await withTransaction(async (client) => {
      const result = await client.query<{
        id: string;
        email: string;
        display_name: string;
        role: "admin" | "approver" | "auditor";
        status: "active" | "disabled";
        created_at: Date;
      }>(
        `
          insert into operators (
            organization_id, email, display_name, role, password_hash
          )
          values ($1, $2, $3, $4, $5)
          returning id, email, display_name, role, status, created_at
        `,
        [
          authorization.operator.organizationId,
          input.email,
          input.displayName,
          input.role,
          passwordHash,
        ],
      );
      const operator = result.rows[0];
      await appendAuditEvent(client, {
        organizationId: authorization.operator.organizationId,
        requestId: null,
        eventType: "operator.created",
        actorType: "human",
        actorId: authorization.operator.email,
        payload: {
          operatorId: operator.id,
          email: operator.email,
          role: operator.role,
        },
      });
      return operator;
    });

    return NextResponse.json(
      {
        id: created.id,
        email: created.email,
        displayName: created.display_name,
        role: created.role,
        status: created.status,
        lastLoginAt: null,
        createdAt: created.created_at.toISOString(),
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
        { error: "An operator with this email already exists." },
        { status: 409 },
      );
    }
    return apiError(error);
  }
}
