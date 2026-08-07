import { NextRequest, NextResponse } from "next/server";
import { withTransaction } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";
import { hasValidInternalBearer } from "@/lib/server/internal-auth";
import { enqueueSecurityDigestNotification } from "@/lib/server/notification-outbox";

export const maxDuration = 60;
const security = /^(operator\.|identity\.|api_key\.|github_app\.|slack\.)/;

async function run(request: NextRequest) {
  try {
    const env = getServerEnv();
    if (!env.SENTINELOPS_CRON_SECRET) return NextResponse.json({ error: "Security digest worker is not configured." }, { status: 503 });
    if (!hasValidInternalBearer(request, env.SENTINELOPS_CRON_SECRET)) return NextResponse.json({ error: "Invalid dispatcher credential." }, { status: 401 });
    const result = await withTransaction(async (client) => {
      const events = await client.query<{ organization_id: string; event_type: string; actor_id: string; created_at: Date }>(
        `select organization_id,event_type,actor_id,created_at from audit_events where created_at >= now() - interval '24 hours' order by created_at desc`,
      );
      const byOrganization = new Map<string, typeof events.rows>();
      for (const event of events.rows) { if (!security.test(event.event_type)) continue; const current = byOrganization.get(event.organization_id) ?? []; current.push(event); byOrganization.set(event.organization_id, current); }
      let enqueued = 0;
      const date = new Date().toISOString().slice(0, 10);
      for (const [organizationId, organizationEvents] of byOrganization) {
        const count = (value: string) => organizationEvents.filter((event) => event.event_type.includes(value)).length;
        const digest = await enqueueSecurityDigestNotification(client, { organizationId, payload: { date, totalEvents: organizationEvents.length, mfaEvents: count("mfa"), sessionEvents: count("session"), credentialEvents: organizationEvents.filter((event) => /api_key|github_app|slack/.test(event.event_type)).length, identityEvents: count("identity"), highlights: organizationEvents.slice(0, 5).map((event) => `${event.event_type} by ${event.actor_id}`) } });
        if (digest.enqueued) enqueued += 1;
      }
      return { organizations: byOrganization.size, enqueued };
    });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
export const GET = run;
export const POST = run;
