import "server-only";

import type { PoolClient } from "pg";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";
import { appendAuditEvent } from "./audit";
import { generateDefaultInvoices } from "./subscription-core";

export * from "./lemonsqueezy-core";

export interface LemonSqueezySubscriptionEvent {
  meta: {
    event_name:
      | "subscription_created"
      | "subscription_updated"
      | "subscription_cancelled"
      | "subscription_resumed"
      | "subscription_expired"
      | "subscription_payment_success"
      | "subscription_payment_failed";
    custom_data?: {
      organization_id?: string;
      operator_id?: string;
      plan_code?: string;
      billing_interval?: string;
    };
  };
  data: {
    id: string;
    type: string;
    attributes: {
      store_id: number;
      customer_id: number;
      order_id: number;
      product_name: string;
      variant_name: string;
      status: "on_trial" | "active" | "paused" | "past_due" | "unpaid" | "cancelled" | "expired";
      renews_at?: string;
      ends_at?: string;
      trial_ends_at?: string;
      card_brand?: string;
      card_last_four?: string;
    };
  };
}

export async function processLemonSqueezyWebhookEvent(
  client: PoolClient,
  event: LemonSqueezySubscriptionEvent,
) {
  const eventName = event.meta.event_name;
  const customData = event.meta.custom_data;
  const attributes = event.data.attributes;
  const organizationId = customData?.organization_id;

  if (!organizationId) {
    console.warn(`[Lemon Squeezy] Webhook received for ${eventName} without organization_id.`);
    return { processed: false, reason: "missing_organization_id" };
  }

  const rawPlan = customData?.plan_code || attributes.product_name || "pro";
  const planCode: PlanCode =
    rawPlan.toLowerCase().includes("enterprise") ? "enterprise" : "pro";
  const plan = planCatalog[planCode];

  const interval: "month" | "year" =
    customData?.billing_interval === "year" || attributes.variant_name?.toLowerCase().includes("annual")
      ? "year"
      : "month";

  let subscriptionStatus: "active" | "past_due" | "canceled" | "paused" | "trialing" = "active";
  if (attributes.status === "past_due" || attributes.status === "unpaid") {
    subscriptionStatus = "past_due";
  } else if (attributes.status === "cancelled" || attributes.status === "expired") {
    subscriptionStatus = "canceled";
  } else if (attributes.status === "paused") {
    subscriptionStatus = "paused";
  } else if (attributes.status === "on_trial") {
    subscriptionStatus = "trialing";
  }

  const endsAt = attributes.renews_at || attributes.ends_at ? new Date(attributes.renews_at || attributes.ends_at!) : null;
  const cardBrand = (attributes.card_brand || "visa").toLowerCase();
  const cardLast4 = attributes.card_last_four || "4242";

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
  } else if (subscriptionStatus === "canceled" && eventName === "subscription_expired") {
    // Revert to pilot upon expiration
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
     ) values ($1, 'lemonsqueezy', $2, $3, $4, $5, $6, $7, $8, $9, now())
     on conflict (organization_id) do update set
       provider = 'lemonsqueezy',
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
      `ls_cus_${attributes.customer_id}`,
      subscriptionStatus,
      interval,
      endsAt,
      attributes.status === "cancelled" && Boolean(attributes.ends_at),
      cardBrand,
      cardLast4,
      JSON.stringify(invoices),
    ],
  );

  // 3. Append cryptographic audit record
  await appendAuditEvent(client, {
    organizationId,
    requestId: null,
    eventType: `billing.lemonsqueezy.${eventName}`,
    actorType: "system",
    actorId: `lemonsqueezy-webhook`,
    payload: {
      event: eventName,
      lemonSqueezySubscriptionId: event.data.id,
      planCode,
      status: subscriptionStatus,
      billingInterval: interval,
      detail: `Lemon Squeezy event ${eventName} processed. Organization plan is ${plan.name} (${subscriptionStatus}).`,
    },
  });

  return { processed: true, planCode, subscriptionStatus };
}
