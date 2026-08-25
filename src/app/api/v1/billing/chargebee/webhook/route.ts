import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import {
  applyChargebeeSubscriptionUpdate,
  mapChargebeePlanIdToPlanCode,
  type ChargebeeWebhookEvent,
} from "@/lib/server/chargebee";

export async function POST(request: Request) {
  try {
    const event = (await request.json()) as ChargebeeWebhookEvent;

    if (!event || !event.event_type) {
      return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
    }

    const sub = event.content?.subscription;
    const cust = event.content?.customer;
    const orgId = cust?.cf_organization_id;

    if (orgId && sub) {
      const planCode = mapChargebeePlanIdToPlanCode(sub.plan_id);
      const endsAt = sub.current_term_end
        ? new Date(sub.current_term_end * 1000)
        : undefined;

      const pool = getPool();
      const client = await pool.connect();
      try {
        await client.query("begin");
        await applyChargebeeSubscriptionUpdate(client, {
          organizationId: orgId,
          planCode,
          subscriptionId: sub.id,
          customerId: sub.customer_id,
          status: sub.status,
          currentPeriodEndsAt: endsAt,
          actorEmail: cust?.email ?? "chargebee-webhook@sentinelops.internal",
        });
        await client.query("commit");
      } catch (err) {
        await client.query("rollback");
        throw err;
      } finally {
        client.release();
      }
    }

    return NextResponse.json({ received: true, event_type: event.event_type });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed." },
      { status: 500 },
    );
  }
}
