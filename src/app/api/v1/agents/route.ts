import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";

const schema = z.object({ name: z.string().trim().min(2).max(160), ownerEmail: z.string().trim().email().max(254), team: z.string().trim().min(2).max(120), provider: z.string().trim().min(2).max(120), environment: z.enum(["development", "staging", "production"]).default("development") });

export async function POST(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    if (!operatorCan(operator.role, "manage_operators")) return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    const input = schema.parse(await request.json());
    const agent = await withTransaction(async (client) => {
      const result = await client.query<{ id: string }>(`insert into agents (organization_id,external_id,name,owner_email,team,provider,environment,last_seen_at,updated_at) values ($1,$2,$3,$4,$5,$6,$7,now(),now()) returning id`, [operator.organizationId, `manual:${randomUUID()}`, input.name, input.ownerEmail, input.team, input.provider, input.environment]);
      await appendAuditEvent(client, { organizationId: operator.organizationId, requestId: null, eventType: "agent.registered", actorType: "human", actorId: operator.email, payload: { agentId: result.rows[0].id, ...input } });
      return result.rows[0];
    });
    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) { return apiError(error); }
}
