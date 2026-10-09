import "server-only";

import {
  Environment,
  EventName,
  Paddle,
  type CustomerNotification,
  type EventEntity,
  type SubscriptionNotification,
  type TransactionNotification,
} from "@paddle/paddle-node-sdk";
import type { PoolClient } from "pg";
import { readPaddlePriceIds } from "@/lib/paddle-pricing";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";
import { appendAuditEvent } from "./audit";
import { subscriptionGrantsPaidAccess } from "./paddle-access";

type PaidPlanCode = Exclude<PlanCode, "pilot">;
type BillingInterval = "month" | "year";

export function getPaddleConfig() {
  const environment = process.env.PADDLE_ENVIRONMENT;
  if (!environment) {
    throw new Error("Missing PADDLE_ENVIRONMENT env var. Set it explicitly to sandbox or production.");
  }
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error("PADDLE_ENVIRONMENT must be sandbox or production.");
  }
  const configuredPriceIds = readPaddlePriceIds((name) => process.env[name]);
  return {
    environment,
    apiKey: process.env.PADDLE_API_KEY || "",
    webhookSecret: process.env.PADDLE_WEBHOOK_SECRET || "",
    priceIds: {
      starter_month: configuredPriceIds.starter_month,
      starter_year: configuredPriceIds.starter_year,
      pro_month: configuredPriceIds.pro_month,
      pro_year: configuredPriceIds.pro_year,
      advanced_month: configuredPriceIds.advanced_month,
      advanced_year: configuredPriceIds.advanced_year,
      enterprise_month: process.env.PADDLE_ENTERPRISE_MONTHLY_PRICE_ID || "",
      enterprise_year: process.env.PADDLE_ENTERPRISE_ANNUAL_PRICE_ID || "",
    } as Record<string, string>,
  };
}

let paddleClient: Paddle | null = null;
let paddleWebhookClient: Paddle | null = null;

export function getPaddleClient() {
  const config = getPaddleConfig();
  if (!config.apiKey) throw new Error("Paddle billing is not configured: set PADDLE_API_KEY.");
  if (!paddleClient) {
    paddleClient = new Paddle(config.apiKey, {
      environment: config.environment === "sandbox" ? Environment.sandbox : Environment.production,
    });
  }
  return paddleClient;
}

export async function unmarshalPaddleWebhook(rawBody: string, signature: string) {
  const config = getPaddleConfig();
  const secret = config.webhookSecret;
  if (!secret) throw new Error("Paddle webhook verification is not configured: set PADDLE_WEBHOOK_SECRET.");
  if (!paddleWebhookClient) {
    // unmarshal is local signature verification; the API key is not used for it.
    paddleWebhookClient = new Paddle(config.apiKey, {
      environment: config.environment === "sandbox" ? Environment.sandbox : Environment.production,
    });
  }
  return paddleWebhookClient.webhooks.unmarshal(rawBody, secret, signature);
}

function planForPaddlePrice(priceId: string): { planCode: PaidPlanCode; billingInterval: BillingInterval } | null {
  const config = getPaddleConfig();
  for (const key of Object.keys(config.priceIds)) {
    if (config.priceIds[key] !== priceId) continue;
    const [rawPlan, rawInterval] = key.split("_");
    if (
      (rawPlan === "starter" || rawPlan === "pro" || rawPlan === "advanced" || rawPlan === "enterprise") &&
      (rawInterval === "month" || rawInterval === "year")
    ) {
      return { planCode: rawPlan, billingInterval: rawInterval };
    }
  }
  return null;
}

export async function createPaddleCheckout(input: {
  organizationId: string;
  operatorId: string;
  email: string;
  name: string;
  planCode: PaidPlanCode;
  billingInterval: BillingInterval;
  requestOrigin: string;
}) {
  const config = getPaddleConfig();
  if (!config.apiKey) throw new Error("Paddle billing is not configured: set PADDLE_API_KEY.");
  const priceId = config.priceIds[input.planCode + "_" + input.billingInterval];
  if (!priceId) throw new Error("Paddle price ID is not configured for this plan and interval.");

  const paddle = getPaddleClient();
  const customer = await paddle.customers.create({
    email: input.email,
    name: input.name,
    customData: { organization_id: input.organizationId, operator_id: input.operatorId },
  });
  if (!customer?.id) throw new Error("Paddle did not return a customer ID.");

  const transaction = await paddle.transactions.create({
    items: [{ priceId, quantity: 1 }],
    customerId: customer.id,
    collectionMode: "automatic",
    customData: {
      organization_id: input.organizationId,
      operator_id: input.operatorId,
      plan_code: input.planCode,
      billing_interval: input.billingInterval,
    },
    checkout: { url: new URL("/dashboard/settings?billing_status=success", input.requestOrigin).toString() },
  });
  const checkoutUrl = transaction?.checkout?.url;
  if (!checkoutUrl) throw new Error("Paddle did not return a checkout URL. Confirm the checkout domain is approved in Paddle.");
  return { checkoutUrl, customerId: customer.id };
}

type PaddleEventEnvelope<T> = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  data: T;
};

async function resolveOrganizationId(
  client: PoolClient,
  customerId: string,
  email?: string | null,
  preferredOrganizationId?: string | null,
) {
  const customer = await client.query<{ organization_id: string | null }>(
    "select organization_id from customers where customer_id = $1",
    [customerId],
  );
  if (customer.rows[0]?.organization_id) return customer.rows[0].organization_id;

  const billing = await client.query<{ organization_id: string }>(
    "select organization_id from organization_billing_accounts where provider = 'paddle' and provider_customer_id = $1",
    [customerId],
  );
  if (billing.rows[0]) return billing.rows[0].organization_id;
  if (preferredOrganizationId) {
    const organization = await client.query<{ id: string }>(
      "select id from organizations where id = $1",
      [preferredOrganizationId],
    );
    if (organization.rows[0]) return organization.rows[0].id;
  }
  if (!email) return null;

  const operators = await client.query<{ organization_id: string }>(
    "select distinct organization_id from operators " +
      "where lower(email) = lower($1) and status in ('active', 'pending_verification') limit 2",
    [email.trim()],
  );
  return operators.rows.length === 1 ? operators.rows[0].organization_id : null;
}

async function ensureCustomerRow(
  client: PoolClient,
  customerId: string,
  organizationId: string | null,
) {
  await client.query(
    "insert into customers (customer_id, organization_id) values ($1, $2) " +
      "on conflict (customer_id) do update set " +
      "organization_id = coalesce(customers.organization_id, excluded.organization_id), updated_at = now()",
    [customerId, organizationId],
  );
}

async function associatePaddleCustomer(
  client: PoolClient,
  organizationId: string,
  customerId: string,
) {
  await client.query(
    "insert into organization_billing_accounts " +
      "(organization_id, provider, provider_customer_id, subscription_status, billing_interval, updated_at) " +
      "values ($1, 'paddle', $2, 'not_configured', 'month', now()) " +
      "on conflict (organization_id) do update set " +
      "provider_customer_id = coalesce(organization_billing_accounts.provider_customer_id, excluded.provider_customer_id), " +
      "updated_at = now() " +
      "where organization_billing_accounts.provider = 'paddle' " +
      "and (organization_billing_accounts.provider_customer_id is null " +
      "or organization_billing_accounts.provider_customer_id = excluded.provider_customer_id)",
    [organizationId, customerId],
  );
}

async function handleCustomerEvent(
  client: PoolClient,
  event: PaddleEventEnvelope<CustomerNotification>,
) {
  const occurredAt = new Date(event.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) throw new Error("Paddle customer event has an invalid occurred_at timestamp.");
  const organizationId = await resolveOrganizationId(
    client,
    event.data.id,
    event.data.email,
    typeof event.data.customData?.organization_id === "string"
      ? event.data.customData.organization_id
      : null,
  );
  const result = await client.query<{ customer_id: string }>(
    "insert into customers (customer_id, organization_id, email, event_occurred_at) " +
      "values ($1, $2, $3, $4) on conflict (customer_id) do update set " +
      "organization_id = coalesce(customers.organization_id, excluded.organization_id), " +
      "email = coalesce(excluded.email, customers.email), " +
      "event_occurred_at = excluded.event_occurred_at, updated_at = now() " +
      "where customers.event_occurred_at is null or excluded.event_occurred_at >= customers.event_occurred_at " +
      "returning customer_id",
    [event.data.id, organizationId, event.data.email || null, occurredAt],
  );
  if (!result.rows[0]) return { ignored: true, reason: "Stale customer event." };
  if (!organizationId) return { processed: true, linked: false };

  await associatePaddleCustomer(client, organizationId, event.data.id);
  await client.query(
    "update subscriptions set organization_id = $2, updated_at = now() " +
      "where customer_id = $1 and organization_id is null",
    [event.data.id, organizationId],
  );
  await syncOrganizationSubscription(client, organizationId, event.data.id);
  return { processed: true, linked: true };
}

async function syncOrganizationSubscription(
  client: PoolClient,
  organizationId: string,
  customerId: string,
) {
  const result = await client.query<{
    subscription_id: string;
    status: string;
    price_id: string;
    scheduled_change_action: string | null;
    scheduled_change_at: Date | null;
    current_period_ends_at: Date | null;
    event_occurred_at: Date;
  }>(
    "select subscription_id, status, price_id, scheduled_change_action, scheduled_change_at, " +
      "current_period_ends_at, event_occurred_at from subscriptions " +
      "where organization_id = $1 and customer_id = $2 " +
      "order by event_occurred_at desc nulls last, updated_at desc limit 1",
    [organizationId, customerId],
  );
  const subscription = result.rows[0];
  if (!subscription) return false;

  const plan = planForPaddlePrice(subscription.price_id);
  const paddleAccount = await client.query<{ organization_id: string }>(
    "insert into organization_billing_accounts (" +
      "organization_id, provider, provider_customer_id, provider_subscription_id, subscription_status, " +
      "price_id, billing_interval, current_period_ends_at, cancel_at_period_end, provider_event_occurred_at, updated_at" +
      ") values ($1, 'paddle', $2, $3, $4, $5, $6, $7, $8, $9, now()) " +
      "on conflict (organization_id) do update set " +
      "provider_customer_id = excluded.provider_customer_id, " +
      "provider_subscription_id = excluded.provider_subscription_id, " +
      "subscription_status = excluded.subscription_status, price_id = excluded.price_id, " +
      "billing_interval = excluded.billing_interval, current_period_ends_at = excluded.current_period_ends_at, " +
      "cancel_at_period_end = excluded.cancel_at_period_end, " +
      "provider_event_occurred_at = excluded.provider_event_occurred_at, updated_at = now() " +
      "where organization_billing_accounts.provider = 'paddle' " +
      "and (organization_billing_accounts.provider_event_occurred_at is null " +
      "or excluded.provider_event_occurred_at >= organization_billing_accounts.provider_event_occurred_at) " +
      "returning organization_id",
    [
      organizationId,
      customerId,
      subscription.subscription_id,
      subscription.status,
      subscription.price_id,
      plan?.billingInterval || "month",
      subscription.current_period_ends_at,
      subscription.scheduled_change_action === "cancel",
      subscription.event_occurred_at,
    ],
  );
  if (!paddleAccount.rows[0]) return false;

  const grantsAccess = subscriptionGrantsPaidAccess({
    status: subscription.status,
    scheduledChangeAction: subscription.scheduled_change_action,
  });
  if (grantsAccess && !plan) return false;

  const planCode: PlanCode = grantsAccess && plan ? plan.planCode : "pilot";
  await client.query(
    "update organizations set plan_code = $2, audit_retention_days = $3, updated_at = now() where id = $1",
    [organizationId, planCode, planCatalog[planCode].auditRetentionDays],
  );
  return true;
}

async function handleSubscriptionEvent(
  client: PoolClient,
  event: PaddleEventEnvelope<SubscriptionNotification>,
) {
  const occurredAt = new Date(event.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) throw new Error("Paddle subscription event has an invalid occurred_at timestamp.");
  const item = event.data.items.find((subscriptionItem) => subscriptionItem.price?.id);
  const price = item?.price;
  if (!price?.id || !price.productId) {
    throw new Error("Paddle subscription event is missing its price or product.");
  }
  const customerId = event.data.customerId;
  const customerRow = await client.query<{ email: string | null; organization_id: string | null }>(
    "select email, organization_id from customers where customer_id = $1",
    [customerId],
  );
  await ensureCustomerRow(client, customerId, customerRow.rows[0]?.organization_id || null);
  const organizationId =
    customerRow.rows[0]?.organization_id ||
    (await resolveOrganizationId(client, customerId, customerRow.rows[0]?.email));
  if (organizationId) {
    await client.query(
      "update customers set organization_id = coalesce(organization_id, $2), updated_at = now() where customer_id = $1",
      [customerId, organizationId],
    );
  }

  const result = await client.query<{ subscription_id: string }>(
    "insert into subscriptions (" +
      "subscription_id, customer_id, organization_id, status, price_id, product_id, " +
      "scheduled_change_action, scheduled_change_at, current_period_ends_at, event_occurred_at" +
      ") values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) " +
      "on conflict (subscription_id) do update set " +
      "customer_id = excluded.customer_id, " +
      "organization_id = coalesce(subscriptions.organization_id, excluded.organization_id), " +
      "status = excluded.status, price_id = excluded.price_id, product_id = excluded.product_id, " +
      "scheduled_change_action = excluded.scheduled_change_action, scheduled_change_at = excluded.scheduled_change_at, " +
      "current_period_ends_at = excluded.current_period_ends_at, event_occurred_at = excluded.event_occurred_at, updated_at = now() " +
      "where subscriptions.event_occurred_at is null or excluded.event_occurred_at >= subscriptions.event_occurred_at " +
      "returning subscription_id",
    [
      event.data.id,
      customerId,
      organizationId,
      event.data.status,
      price.id,
      price.productId,
      event.data.scheduledChange?.action || null,
      event.data.scheduledChange?.effectiveAt || null,
      event.data.currentBillingPeriod?.endsAt || null,
      occurredAt,
    ],
  );
  if (!result.rows[0]) return { ignored: true, reason: "Stale subscription event." };

  if (organizationId) {
    await associatePaddleCustomer(client, organizationId, customerId);
    await syncOrganizationSubscription(client, organizationId, customerId);
    await appendAuditEvent(client, {
      organizationId,
      requestId: null,
      eventType: "billing.paddle." + event.eventType,
      actorType: "system",
      actorId: "paddle",
      payload: {
        eventId: event.eventId,
        subscriptionId: event.data.id,
        customerId,
        status: event.data.status,
        priceId: price.id,
      },
    });
  }
  return { processed: true, linked: Boolean(organizationId), status: event.data.status };
}

async function handleTransactionCompleted(
  client: PoolClient,
  event: PaddleEventEnvelope<TransactionNotification>,
) {
  const occurredAt = new Date(event.occurredAt);
  if (Number.isNaN(occurredAt.getTime())) throw new Error("Paddle transaction event has an invalid occurred_at timestamp.");
  const result = await client.query<{ transaction_id: string }>(
    "insert into paddle_transactions (transaction_id, customer_id, subscription_id, status, event_occurred_at) " +
      "values ($1, $2, $3, $4, $5) on conflict (transaction_id) do update set " +
      "customer_id = coalesce(excluded.customer_id, paddle_transactions.customer_id), " +
      "subscription_id = coalesce(excluded.subscription_id, paddle_transactions.subscription_id), " +
      "status = excluded.status, event_occurred_at = excluded.event_occurred_at, updated_at = now() " +
      "where excluded.event_occurred_at >= paddle_transactions.event_occurred_at returning transaction_id",
    [event.data.id, event.data.customerId, event.data.subscriptionId, event.data.status, occurredAt],
  );
  return result.rows[0]
    ? { processed: true, transactionId: event.data.id }
    : { ignored: true, reason: "Stale transaction event." };
}

export async function processPaddleEvent(client: PoolClient, event: EventEntity) {
  const inserted = await client.query<{ event_id: string }>(
    "insert into paddle_webhook_events (event_id, event_type) values ($1, $2) " +
      "on conflict (event_id) do nothing returning event_id",
    [event.eventId, event.eventType],
  );
  if (!inserted.rows[0]) return { duplicate: true };

  const envelope = {
    eventId: event.eventId,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
  };
  switch (event.eventType) {
    case EventName.CustomerCreated:
    case EventName.CustomerUpdated:
      return handleCustomerEvent(client, { ...envelope, data: event.data as CustomerNotification });
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionUpdated:
    case EventName.SubscriptionCanceled:
    case EventName.SubscriptionTrialing:
    case EventName.SubscriptionActivated:
    case EventName.SubscriptionPaused:
    case EventName.SubscriptionPastDue:
    case EventName.SubscriptionResumed:
      return handleSubscriptionEvent(client, { ...envelope, data: event.data as SubscriptionNotification });
    case EventName.TransactionCompleted:
      return handleTransactionCompleted(client, { ...envelope, data: event.data as TransactionNotification });
    default:
      return { ignored: true, reason: "Unsupported Paddle event type." };
  }
}
