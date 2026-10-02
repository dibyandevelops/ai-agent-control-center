import { NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { simulateSubscriptionScenario } from "@/lib/server/subscription-core";
import { getPaddleClient } from "@/lib/server/paddle";

const manageActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("portal") }),
  z.object({
    action: z.literal("change_plan"),
    planCode: z.enum(["pilot", "starter", "pro", "advanced", "enterprise"]),
    billingInterval: z.enum(["month", "year"]).default("month"),
  }),
  z.object({
    action: z.literal("cancel"),
    immediately: z.boolean().default(false),
    reason: z.string().default("Customer requested cancellation"),
  }),
  z.object({
    action: z.literal("reactivate"),
  }),
  z.object({
    action: z.literal("pause"),
    pauseMonths: z.number().int().min(1).max(12).default(1),
  }),
  z.object({
    action: z.literal("resume"),
  }),
  z.object({
    action: z.literal("update_payment_method"),
    cardBrand: z.string().min(2).default("visa"),
    cardLast4: z.string().regex(/^\d{4}$/).default("4242"),
    cardExp: z.string().default("12/28"),
  }),
  z.object({
    action: z.literal("simulate_scenario"),
    scenarioKey: z.enum([
      "active_pro",
      "enterprise_annual",
      "past_due",
      "canceled_grace",
      "paused_staging",
      "pilot_reset",
    ]),
  }),
]);

export async function POST(request: Request) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }
    if (!operatorCan(operator.role, "manage_operators")) {
      return NextResponse.json(
        { error: "Admin role required to manage subscription." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const input = manageActionSchema.parse(body);

    if (input.action !== "portal" && (process.env.NODE_ENV === "production" || input.action !== "simulate_scenario")) {
      return NextResponse.json(
        { error: "Subscription changes must be completed in Paddle's secure customer portal. Use Paddle checkout to start or change a plan." },
        { status: 409 },
      );
    }
    if (input.action === "portal") {
      const billing = await getPool().query<{
        customer_id: string;
        subscription_ids: string[];
      }>(
        "select c.customer_id, coalesce(array_agg(s.subscription_id) filter (where s.subscription_id is not null), '{}') as subscription_ids " +
          "from customers c left join subscriptions s on s.customer_id = c.customer_id and s.organization_id = c.organization_id " +
          "where c.organization_id = $1 group by c.customer_id order by c.customer_id limit 2",
        [operator.organizationId],
      );
      const account = billing.rows[0];
      if (!account?.customer_id) {
        return NextResponse.json({ error: "No Paddle billing account exists for this workspace yet." }, { status: 409 });
      }
      if (billing.rows.length > 1) {
        return NextResponse.json({ error: "Multiple Paddle customers are linked to this workspace; support must reconcile the billing records." }, { status: 409 });
      }
      const portal = await getPaddleClient().customerPortalSessions.create(
        account.customer_id,
        account.subscription_ids,
      );
      return NextResponse.json({ success: true, url: portal.urls.general.overview });
    }

    if (input.action !== "simulate_scenario") {
      return NextResponse.json({ error: "Unsupported subscription action." }, { status: 400 });
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("begin");
      const subscription = await simulateSubscriptionScenario(client, {
        organizationId: operator.organizationId,
        scenarioKey: input.scenarioKey,
        operatorId: operator.id,
        actorEmail: operator.email,
      });
      await client.query("commit");
      return NextResponse.json({ success: true, subscription });
    } catch (err) {
      await client.query("rollback").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
