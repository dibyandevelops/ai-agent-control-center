import { NextResponse } from "next/server";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ keyId: string }> },
) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }
    if (!operatorCan(operator.role, "manage_api_keys")) {
      return NextResponse.json(
        { error: "Admin role required." },
        { status: 403 },
      );
    }
    const { keyId } = await context.params;
    const revoked = await withTransaction(async (client) => {
      const result = await client.query<{
        id: string;
        name: string;
        key_prefix: string;
        revoked_at: Date;
      }>(
        `
          update api_keys
          set revoked_at = now()
          where id = $1
            and organization_id = $2
            and revoked_at is null
          returning id, name, key_prefix, revoked_at
        `,
        [keyId, operator.organizationId],
      );
      const row = result.rows[0];
      if (!row) return null;
      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId: null,
        eventType: "api_key.revoked",
        actorType: "human",
        actorId: operator.email,
        payload: { apiKeyId: row.id, name: row.name, keyPrefix: row.key_prefix },
      });
      return row;
    });
    if (!revoked) {
      return NextResponse.json(
        { error: "Active API key not found." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      id: revoked.id,
      status: "revoked",
      revokedAt: revoked.revoked_at.toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}

