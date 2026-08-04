import { NextResponse } from "next/server";
import {
  generateAgentApiKey,
  getAgentApiKeyPrefix,
  hashAgentApiKey,
} from "@/lib/server/agent-api-key";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";

export async function POST(
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
    const secret = generateAgentApiKey();
    const rotated = await withTransaction(async (client) => {
      const currentResult = await client.query<{
        id: string;
        name: string;
        key_prefix: string;
      }>(
        `
          select id, name, key_prefix
          from api_keys
          where id = $1
            and organization_id = $2
            and revoked_at is null
          for update
        `,
        [keyId, operator.organizationId],
      );
      const current = currentResult.rows[0];
      if (!current) return null;

      await client.query(
        "update api_keys set revoked_at = now() where id = $1",
        [current.id],
      );
      const createdResult = await client.query<{
        id: string;
        name: string;
        key_prefix: string;
        last_used_at: Date | null;
        revoked_at: Date | null;
        created_at: Date;
      }>(
        `
          insert into api_keys (organization_id, name, key_prefix, key_hash)
          values ($1, $2, $3, $4)
          returning id, name, key_prefix, last_used_at, revoked_at, created_at
        `,
        [
          operator.organizationId,
          current.name,
          getAgentApiKeyPrefix(secret),
          hashAgentApiKey(secret),
        ],
      );
      const created = createdResult.rows[0];
      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId: null,
        eventType: "api_key.rotated",
        actorType: "human",
        actorId: operator.email,
        payload: {
          previousApiKeyId: current.id,
          apiKeyId: created.id,
          name: created.name,
          keyPrefix: created.key_prefix,
        },
      });
      return created;
    });
    if (!rotated) {
      return NextResponse.json(
        { error: "Active API key not found." },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        apiKey: {
          id: rotated.id,
          name: rotated.name,
          keyPrefix: rotated.key_prefix,
          status: "active",
          lastUsedAt: null,
          revokedAt: null,
          createdAt: rotated.created_at.toISOString(),
        },
        revokedApiKeyId: keyId,
        secret,
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
