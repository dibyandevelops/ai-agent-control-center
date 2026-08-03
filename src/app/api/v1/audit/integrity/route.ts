import { NextRequest, NextResponse } from "next/server";
import { verifyAuditChain, type AuditChainEvent } from "@/lib/server/audit-chain";
import { hasAdminSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";

export async function GET(request: NextRequest) {
  try {
    if (!(await hasAdminSession(request))) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }

    const result = await getPool().query<{
      id: string;
      organization_id: string;
      request_id: string | null;
      event_type: string;
      actor_type: "agent" | "policy" | "human" | "system";
      actor_id: string;
      payload: Record<string, unknown>;
      previous_hash: string | null;
      event_hash: string;
    }>(`
      select
        id::text,
        organization_id,
        request_id,
        event_type,
        actor_type,
        actor_id,
        payload,
        previous_hash,
        event_hash
      from audit_events ae
      order by ae.organization_id, ae.id asc
    `);

    const chains = new Map<string, AuditChainEvent[]>();
    for (const row of result.rows) {
      const chain = chains.get(row.organization_id) ?? [];
      chain.push({
        id: row.id,
        requestId: row.request_id,
        eventType: row.event_type,
        actorType: row.actor_type,
        actorId: row.actor_id,
        payload: row.payload,
        previousHash: row.previous_hash,
        eventHash: row.event_hash,
      });
      chains.set(row.organization_id, chain);
    }

    for (const events of chains.values()) {
      const verification = verifyAuditChain(events);
      if (!verification.verified) {
        return NextResponse.json({
          verified: false,
          eventsChecked: result.rowCount ?? result.rows.length,
          organizationsChecked: chains.size,
          firstInvalidEventId: verification.firstInvalidEventId,
          checkedAt: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      verified: true,
      eventsChecked: result.rowCount ?? result.rows.length,
      organizationsChecked: chains.size,
      firstInvalidEventId: null,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    return apiError(error);
  }
}
