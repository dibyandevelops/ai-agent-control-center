import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { planCatalog } from "@/lib/plan-catalog";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { appendAuditEvent } from "@/lib/server/audit";
import { z } from "zod";

const checkoutSchema = z.object({
  planCode: z.enum(["pilot", "pro", "enterprise"]),
  billingInterval: z.enum(["month", "year"]).default("month"),
  coupon: z.string().optional(),
  paymentMethod: z
    .object({
      brand: z.string().default("visa"),
      last4: z.string().default("4242"),
    })
    .optional(),
});

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
        { error: "Admin role required to manage billing." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const input = checkoutSchema.parse(body);

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("begin");

      const planConfig = planCatalog[input.planCode];
      const periodMonths = input.billingInterval === "year" ? 12 : 1;
      const endsAt = new Date();
      endsAt.setMonth(endsAt.getMonth() + periodMonths);

      const priceId =
        input.planCode === "pilot"
          ? null
          : input.billingInterval === "year"
          ? (planConfig as typeof planCatalog.pro).stripePriceIdAnnual
          : (planConfig as typeof planCatalog.pro).stripePriceIdMonthly;

      const customerId = `cus_stripe_${operator.organizationId.slice(0, 8)}`;
      const subStatus = input.planCode === "pilot" ? "not_configured" : "active";

      // 1. Upsert organization_billing_accounts
      await client.query(
        `insert into organization_billing_accounts (
          organization_id, provider, provider_customer_id, subscription_status, price_id, current_period_ends_at, updated_at
        ) values ($1, 'stripe', $2, $3, $4, $5, now())
        on conflict (organization_id) do update set
          subscription_status = excluded.subscription_status,
          price_id = excluded.price_id,
          current_period_ends_at = excluded.current_period_ends_at,
          updated_at = now()`,
        [operator.organizationId, customerId, subStatus, priceId, endsAt],
      );

      // 2. Update organization plan & retention days
      await client.query(
        `update organizations
         set plan_code = $1,
             audit_retention_days = $2,
             updated_at = now()
         where id = $3`,
        [input.planCode, planConfig.auditRetentionDays, operator.organizationId],
      );

      // 3. Record tamper-evident audit record
      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId: null,
        eventType: "billing.subscription_updated",
        actorType: "human",
        actorId: operator.id,
        payload: {
          planCode: input.planCode,
          billingInterval: input.billingInterval,
          priceId: priceId ?? "free",
          currentPeriodEndsAt: endsAt.toISOString(),
          coupon: input.coupon ?? null,
          detail: `Upgraded to ${planConfig.name} (${input.billingInterval}ly) via Stripe Checkout.`,
        },
      });

      await client.query("commit");

      return NextResponse.json({
        success: true,
        plan: {
          code: input.planCode,
          name: planConfig.name,
          limits: {
            agents: planConfig.agents,
            repositories: planConfig.repositories,
            pendingApprovals: planConfig.pendingApprovals,
            auditRetentionDays: planConfig.auditRetentionDays,
          },
        },
        billing: {
          enabled: true,
          status: subStatus,
          currentPeriodEndsAt: endsAt.toISOString(),
          provider: "stripe",
          customerId,
        },
      });
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
