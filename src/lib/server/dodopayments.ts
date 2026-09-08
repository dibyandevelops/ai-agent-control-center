import "server-only";

import type { PoolClient } from "pg";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";
import { appendAuditEvent } from "./audit";
import { generateDefaultInvoices } from "./subscription-core";

export * from "./dodopayments-core";

export interface DodoPaymentsSubscriptionEvent {
  type:
    | "subscription.active"
    | "subscription.renewed"
    | "subscription.cancelled"
    | "subscription.on_hold"
    | "subscription.updated"
    | "payment.succeeded"
    | "payment.failed";
  data: {
    subscription_id?: string;
    payment_id?: string;
    customer_id?: string;
    product_id?: string;
    status?: "active" | "on_hold" | "cancelled" | "expired" | "pending";
    next_billing_date?: string;
    created_at?: string;
    metadata?: {
      organization_id?: string;
      operator_id?: string;
      plan_code?: string;
      billing_interval?: string;
    };
    customer?: {
      customer_id?: string;
      email?: string;
      name?: string;
    };
    card_brand?: string;
    card_last_four?: string;
  };
}

export async function processDodoPaymentsWebhookEvent(
  client: PoolClient,
  event: DodoPaymentsSubscriptionEvent,
) {
  const eventType = event.type;
  const data = event.data;
  const metadata = data.metadata || {};
  const organizationId = metadata.organization_id;

  if (!organizationId) {
    console.warn(`[Dodo Payments] Webhook received for ${eventType} without organization_id.`);
    return { processed: false, reason: "missing_organization_id" };
  }

  const rawPlan = metadata.plan_code || "pro";
  const planCode: PlanCode = rawPlan.toLowerCase().includes("enterprise") ? "enterprise" : "pro";
  const plan = planCatalog[planCode];

  const interval: "month" | "year" =
    metadata.billing_interval === "year" ? "year" : "month";

  let subscriptionStatus: "active" | "past_due" | "canceled" | "paused" | "trialing" = "active";
  if (eventType === "subscription.cancelled") {
    subscriptionStatus = "canceled";
  } else if (eventType === "subscription.on_hold" || eventType === "payment.failed") {
    subscriptionStatus = "past_due";
  } else if (data.status === "cancelled") {
    subscriptionStatus = "canceled";
  } else if (data.status === "on_hold") {
    subscriptionStatus = "past_due";
  }

  const endsAt = data.next_billing_date ? new Date(data.next_billing_date) : null;
  const cardBrand = (data.card_brand || "visa").toLowerCase();
  const cardLast4 = data.card_last_four || "4242";

  // 1. Update Organization limits
  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    await client.query(
      `update organizations
       set plan_code = $1,
           audit_retention_days = $2,
           updated_at = now()
       where id = $3`,
      [planCode, plan.auditRetentionDays, organizationId],
    );
  } else if (subscriptionStatus === "canceled") {
    // Revert to pilot upon cancellation / expiry
    await client.query(
      `update organizations
       set plan_code = 'pilot',
           audit_retention_days = $1,
           updated_at = now()
       where id = $2`,
      [planCatalog.pilot.auditRetentionDays, organizationId],
    );
  }

  // 2. Upsert Billing Account
  const invoices = generateDefaultInvoices(planCode, interval);
  await client.query(
    `insert into organization_billing_accounts (
       organization_id,
       provider,
       provider_customer_id,
       subscription_status,
       billing_interval,
       current_period_ends_at,
       cancel_at_period_end,
       card_brand,
       card_last4,
       invoices,
       updated_at
     ) values ($1, 'dodopayments', $2, $3, $4, $5, $6, $7, $8, $9, now())
     on conflict (organization_id) do update set
       provider = 'dodopayments',
       provider_customer_id = excluded.provider_customer_id,
       subscription_status = excluded.subscription_status,
       billing_interval = excluded.billing_interval,
       current_period_ends_at = coalesce(excluded.current_period_ends_at, organization_billing_accounts.current_period_ends_at),
       cancel_at_period_end = excluded.cancel_at_period_end,
       card_brand = excluded.card_brand,
       card_last4 = excluded.card_last4,
       invoices = excluded.invoices,
       updated_at = now()`,
    [
      organizationId,
      data.customer_id || data.customer?.customer_id || `dodo_cus_${organizationId.slice(0, 8)}`,
      subscriptionStatus,
      interval,
      endsAt,
      subscriptionStatus === "canceled",
      cardBrand,
      cardLast4,
      JSON.stringify(invoices),
    ],
  );

  // 3. Append to Merkle Audit Chain
  await appendAuditEvent(client, {
    organizationId,
    requestId: null,
    eventType: `billing.dodopayments.${eventType.replace(".", "_")}`,
    actorType: "system",
    actorId: `dodopayments-webhook`,
    payload: {
      provider: "dodopayments",
      eventType,
      planCode,
      subscriptionStatus,
      billingInterval: interval,
      subscriptionId: data.subscription_id,
      paymentId: data.payment_id,
      detail: `Dodo Payments event ${eventType} processed. Organization plan is ${plan.name} (${subscriptionStatus}).`,
    },
  });

  return {
    processed: true,
    planCode,
    subscriptionStatus,
  };
}
