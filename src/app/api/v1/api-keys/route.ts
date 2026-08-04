import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const createApiKeySchema = z.object({
  name: z.string().trim().min(2).max(120),
});

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: Date | null;
  revoked_at: Date | null;
  created_at: Date;
}

function serializeApiKey(row: ApiKeyRow) {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    status: row.revoked_at ? ("revoked" as const) : ("active" as const),
    lastUsedAt: row.last_used_at?.toISOString() ?? null,
    revokedAt: row.revoked_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

async function requireAdmin() {
  const operator = await getOperatorSession();
  if (!operator) {
    return {
      operator: null,
      response: NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      ),
    };
  }
  if (!operatorCan(operator.role, "manage_api_keys")) {
    return {
      operator: null,
      response: NextResponse.json(
        { error: "Admin role required." },
        { status: 403 },
      ),
    };
  }
  return { operator, response: null };
}

export async function GET() {
  try {
    const authorization = await requireAdmin();
    if (!authorization.operator) return authorization.response;
    const keys = await withTransaction(async (client) => {
      const result = await client.query<ApiKeyRow>(
        `
          select id, name, key_prefix, last_used_at, revoked_at, created_at
          from api_keys
          where organization_id = $1
          order by revoked_at nulls first, created_at desc
        `,
        [authorization.operator.organizationId],
      );
      return result.rows.map(serializeApiKey);
    });
    return NextResponse.json(
      { apiKeys: keys },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.operator) return authorization.response;
    const input = createApiKeySchema.parse(await request.json());
    const apiKey = generateAgentApiKey();
    const created = await withTransaction(async (client) => {
      const result = await client.query<ApiKeyRow>(
        `
          insert into api_keys (organization_id, name, key_prefix, key_hash)
          values ($1, $2, $3, $4)
          returning id, name, key_prefix, last_used_at, revoked_at, created_at
        `,
        [
          authorization.operator.organizationId,
          input.name,
          getAgentApiKeyPrefix(apiKey),
          hashAgentApiKey(apiKey),
        ],
      );
      const row = result.rows[0];
      await appendAuditEvent(client, {
        organizationId: authorization.operator.organizationId,
        requestId: null,
        eventType: "api_key.created",
        actorType: "human",
        actorId: authorization.operator.email,
        payload: { apiKeyId: row.id, name: row.name, keyPrefix: row.key_prefix },
      });
      return serializeApiKey(row);
    });
    return NextResponse.json(
      { apiKey: created, secret: apiKey },
      {
        status: 201,
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

