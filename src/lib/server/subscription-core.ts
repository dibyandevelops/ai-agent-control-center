import "server-only";

import type { PoolClient } from "pg";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";
import { appendAuditEvent } from "./audit";

export type SubscriptionStatus =
  | "not_configured"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "paused";

export type BillingInterval = "month" | "year";

export interface MockInvoice {
  id: string;
  number: string;
  date: string;
  amountDue: number;
  amountPaid: number;
  status: "paid" | "open" | "void" | "uncollectible";
  pdfUrl?: string;
  description: string;
  planName: string;
  periodStart: string;
  periodEnd: string;
}

export interface PaymentMethodInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  funding: string;
}

export interface SubscriptionDetails {
  planCode: PlanCode;
  planName: string;
  status: SubscriptionStatus;
  billingInterval: BillingInterval;
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  paymentMethod: PaymentMethodInfo;
  limits: {
    agents: number | null;
    repositories: number | null;
    pendingApprovals: number | null;
    auditRetentionDays: number;
    httpsWebhooks: number | null;
  };
  pricing: {
    monthly: number;
    annual: number;
    currency: string;
  };
  invoices: MockInvoice[];
}

export function generateDefaultInvoices(planCode: PlanCode, interval: BillingInterval): MockInvoice[] {
  const plan = planCatalog[planCode];
  const amount = interval === "year" ? plan.priceAnnual * 12 : plan.priceMonthly;
  if (amount === 0) return [];

  const now = new Date();
  const lastMonth = new Date(now);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  return [
    {
      id: "inv_recent_01",
      number: `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-042`,
      date: lastMonth.toISOString(),
      amountDue: amount,
      amountPaid: amount,
      status: "paid",
      description: `${plan.name} (${interval === "year" ? "Annual" : "Monthly"}) Subscription Renewal`,
      planName: plan.name,
      periodStart: lastMonth.toISOString(),
      periodEnd: now.toISOString(),
    },
    {
      id: "inv_prior_02",
      number: `INV-${twoMonthsAgo.getFullYear()}-${String(twoMonthsAgo.getMonth() + 1).padStart(2, "0")}-089`,
      date: twoMonthsAgo.toISOString(),
      amountDue: amount,
      amountPaid: amount,
      status: "paid",
      description: `${plan.name} (${interval === "year" ? "Annual" : "Monthly"}) Subscription Initial Activation`,
      planName: plan.name,
      periodStart: twoMonthsAgo.toISOString(),
      periodEnd: lastMonth.toISOString(),
    },
  ];
}

export async function getSubscriptionDetails(
  client: PoolClient,
  organizationId: string,
): Promise<SubscriptionDetails> {
  const orgResult = await client.query<{
    plan_code: PlanCode;
    audit_retention_days: number;
  }>(
    "select plan_code, audit_retention_days from organizations where id = $1",
    [organizationId],
  );

  const org = orgResult.rows[0];
  const planCode: PlanCode = (org?.plan_code && planCatalog[org.plan_code]) ? org.plan_code : "pro";
  const plan = planCatalog[planCode];

  const billingResult = await client.query<{
    subscription_status: SubscriptionStatus;
    billing_interval: BillingInterval;
    current_period_ends_at: Date | null;
    cancel_at_period_end: boolean;
    card_brand: string;
    card_last4: string;
    card_exp: string;
    invoices: MockInvoice[];
  }>(
    `select subscription_status, billing_interval, current_period_ends_at, cancel_at_period_end, card_brand, card_last4, card_exp, invoices
     from organization_billing_accounts
     where organization_id = $1`,
    [organizationId],
  );

  const billing = billingResult.rows[0];
  const status: SubscriptionStatus = billing?.subscription_status || (planCode === "pilot" ? "not_configured" : "active");
  const billingInterval: BillingInterval = billing?.billing_interval || "month";
  
  let endsAt = billing?.current_period_ends_at ? billing.current_period_ends_at.toISOString() : null;
  if (!endsAt && status === "active") {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    endsAt = d.toISOString();
  }

  const [expMonthStr, expYearStr] = (billing?.card_exp || "12/28").split("/");
  const paymentMethod: PaymentMethodInfo = {
    brand: billing?.card_brand || "visa",
    last4: billing?.card_last4 || "4242",
    expMonth: Number(expMonthStr) || 12,
    expYear: Number(`20${expYearStr}`) || 2028,
    funding: "credit",
  };

  const invoices: MockInvoice[] =
    billing?.invoices && Array.isArray(billing.invoices) && billing.invoices.length > 0
      ? billing.invoices
      : generateDefaultInvoices(planCode, billingInterval);

  return {
    planCode,
    planName: plan.name,
    status,
    billingInterval,
    currentPeriodEndsAt: endsAt,
    cancelAtPeriodEnd: billing?.cancel_at_period_end ?? false,
    paymentMethod,
    limits: {
      agents: plan.agents,
      repositories: plan.repositories,
      pendingApprovals: plan.pendingApprovals,
      auditRetentionDays: org?.audit_retention_days ?? plan.auditRetentionDays,
      httpsWebhooks: plan.httpsWebhooks,
    },
    pricing: {
      monthly: plan.priceMonthly,
      annual: plan.priceAnnual,
      currency: "USD",
    },
    invoices,
  };
}

export async function updateSubscriptionPlan(
  client: PoolClient,
  input: {
    organizationId: string;
    planCode: PlanCode;
    billingInterval: BillingInterval;
    operatorId: string;
    actorEmail: string;
  },
): Promise<SubscriptionDetails> {
  const plan = planCatalog[input.planCode];
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + (input.billingInterval === "year" ? 365 : 30));

  const status: SubscriptionStatus = input.planCode === "pilot" ? "not_configured" : "active";

  // Update organizations plan & retention
  await client.query(
    `update organizations
     set plan_code = $1,
         audit_retention_days = $2,
         updated_at = now()
     where id = $3`,
    [input.planCode, plan.auditRetentionDays, input.organizationId],
  );

  const newInvoices = generateDefaultInvoices(input.planCode, input.billingInterval);

  // Update or insert billing record
  await client.query(
    `insert into organization_billing_accounts (
       organization_id,
       provider,
       provider_customer_id,
       subscription_status,
       billing_interval,
       current_period_ends_at,
       cancel_at_period_end,
       invoices,
       updated_at
     ) values ($1, 'stripe', $2, $3, $4, $5, false, $6, now())
     on conflict (organization_id) do update set
       subscription_status = excluded.subscription_status,
       billing_interval = excluded.billing_interval,
       current_period_ends_at = excluded.current_period_ends_at,
       cancel_at_period_end = false,
       invoices = excluded.invoices,
       updated_at = now()`,
    [
      input.organizationId,
      `cus_sentinel_${input.organizationId.slice(0, 8)}`,
      status,
      input.billingInterval,
      endsAt,
      JSON.stringify(newInvoices),
    ],
  );

  await appendAuditEvent(client, {
    organizationId: input.organizationId,
    requestId: null,
    eventType: "billing.subscription_plan_changed",
    actorType: "human",
    actorId: input.operatorId,
    payload: {
      planCode: input.planCode,
      billingInterval: input.billingInterval,
      status,
      detail: `Switched subscription to ${plan.name} (${input.billingInterval}). Limits updated: ${plan.agents ?? "Unlimited"} agents.`,
    },
  });

  return getSubscriptionDetails(client, input.organizationId);
}

export async function cancelSubscription(
  client: PoolClient,
  input: {
    organizationId: string;
    immediately: boolean;
    reason: string;
    operatorId: string;
    actorEmail: string;
  },
): Promise<SubscriptionDetails> {
  const newStatus: SubscriptionStatus = input.immediately ? "canceled" : "active";
  const cancelAtPeriodEnd = !input.immediately;

  if (input.immediately) {
    // Revert to pilot immediately
    const pilotPlan = planCatalog.pilot;
    await client.query(
      `update organizations
       set plan_code = 'pilot',
           audit_retention_days = $1,
           updated_at = now()
       where id = $2`,
      [pilotPlan.auditRetentionDays, input.organizationId],
    );
  }

  await client.query(
    `update organization_billing_accounts
     set subscription_status = $1,
         cancel_at_period_end = $2,
         updated_at = now()
     where organization_id = $3`,
    [newStatus, cancelAtPeriodEnd, input.organizationId],
  );

  await appendAuditEvent(client, {
    organizationId: input.organizationId,
    requestId: null,
    eventType: "billing.subscription_cancelled",
    actorType: "human",
    actorId: input.operatorId,
    payload: {
      immediately: input.immediately,
      reason: input.reason,
      cancelAtPeriodEnd,
      detail: input.immediately
        ? `Subscription cancelled immediately. Reason: ${input.reason}. Reverted to Pilot plan.`
        : `Subscription scheduled for cancellation at period end. Reason: ${input.reason}.`,
    },
  });

  return getSubscriptionDetails(client, input.organizationId);
}

export async function reactivateSubscription(
  client: PoolClient,
  input: {
    organizationId: string;
    operatorId: string;
    actorEmail: string;
  },
): Promise<SubscriptionDetails> {
  const endsAt = new Date();
  endsAt.setDate(endsAt.getDate() + 30);

  // Restore Pro if previously degraded
  const orgResult = await client.query<{ plan_code: PlanCode }>(
    "select plan_code from organizations where id = $1",
    [input.organizationId],
  );
  const currentPlan = orgResult.rows[0]?.plan_code;
  const targetPlan: PlanCode = currentPlan === "pilot" ? "pro" : currentPlan;
  const targetConfig = planCatalog[targetPlan];

  await client.query(
    `update organizations
     set plan_code = $1,
         audit_retention_days = $2,
         updated_at = now()
     where id = $3`,
    [targetPlan, targetConfig.auditRetentionDays, input.organizationId],
  );

  await client.query(
    `update organization_billing_accounts
     set subscription_status = 'active',
         cancel_at_period_end = false,
         current_period_ends_at = coalesce(current_period_ends_at, $1),
         updated_at = now()
     where organization_id = $2`,
    [endsAt, input.organizationId],
  );

  await appendAuditEvent(client, {
    organizationId: input.organizationId,
    requestId: null,
    eventType: "billing.subscription_reactivated",
    actorType: "human",
    actorId: input.operatorId,
    payload: {
      planCode: targetPlan,
      status: "active",
      detail: `Subscription reactivated successfully for ${targetConfig.name}. Cancellation flag cleared.`,
    },
  });

  return getSubscriptionDetails(client, input.organizationId);
}

export async function pauseSubscription(
  client: PoolClient,
  input: {
    organizationId: string;
    pauseMonths: number;
    operatorId: string;
    actorEmail: string;
  },
): Promise<SubscriptionDetails> {
  await client.query(
    `update organization_billing_accounts
     set subscription_status = 'paused',
         updated_at = now()
     where organization_id = $1`,
    [input.organizationId],
  );

  await appendAuditEvent(client, {
    organizationId: input.organizationId,
    requestId: null,
    eventType: "billing.subscription_paused",
    actorType: "human",
    actorId: input.operatorId,
    payload: {
      pauseMonths: input.pauseMonths,
      status: "paused",
      detail: `Subscription billing paused for ${input.pauseMonths} month(s). Agent evaluation limits preserved.`,
    },
  });

  return getSubscriptionDetails(client, input.organizationId);
}

export async function updatePaymentMethod(
  client: PoolClient,
  input: {
    organizationId: string;
    cardBrand: string;
    cardLast4: string;
    cardExp: string;
    operatorId: string;
    actorEmail: string;
  },
): Promise<SubscriptionDetails> {
  await client.query(
    `insert into organization_billing_accounts (
       organization_id,
       card_brand,
       card_last4,
       card_exp,
       updated_at
     ) values ($1, $2, $3, $4, now())
     on conflict (organization_id) do update set
       card_brand = excluded.card_brand,
       card_last4 = excluded.card_last4,
       card_exp = excluded.card_exp,
       updated_at = now()`,
    [input.organizationId, input.cardBrand.toLowerCase(), input.cardLast4, input.cardExp],
  );

  await appendAuditEvent(client, {
    organizationId: input.organizationId,
    requestId: null,
    eventType: "billing.payment_method_updated",
    actorType: "human",
    actorId: input.operatorId,
    payload: {
      cardBrand: input.cardBrand,
      cardLast4: input.cardLast4,
      detail: `Updated primary payment method to ${input.cardBrand.toUpperCase()} ending in •••• ${input.cardLast4}.`,
    },
  });

  return getSubscriptionDetails(client, input.organizationId);
}

export async function simulateSubscriptionScenario(
  client: PoolClient,
  input: {
    organizationId: string;
    scenarioKey:
      | "active_pro"
      | "enterprise_annual"
      | "past_due"
      | "canceled_grace"
      | "paused_staging"
      | "pilot_reset";
    operatorId: string;
    actorEmail: string;
  },
): Promise<SubscriptionDetails> {
  const now = new Date();

  switch (input.scenarioKey) {
    case "active_pro": {
      const endsAt = new Date(now);
      endsAt.setDate(endsAt.getDate() + 27);
      await client.query(
        `update organizations set plan_code = 'pro', audit_retention_days = 365, updated_at = now() where id = $1`,
        [input.organizationId],
      );
      await client.query(
        `insert into organization_billing_accounts (
           organization_id, subscription_status, billing_interval, current_period_ends_at, cancel_at_period_end,
           card_brand, card_last4, card_exp, invoices, updated_at
         ) values ($1, 'active', 'month', $2, false, 'visa', '4242', '12/28', $3, now())
         on conflict (organization_id) do update set
           subscription_status = 'active',
           billing_interval = 'month',
           current_period_ends_at = excluded.current_period_ends_at,
           cancel_at_period_end = false,
           card_brand = 'visa',
           card_last4 = '4242',
           card_exp = '12/28',
           invoices = excluded.invoices,
           updated_at = now()`,
        [input.organizationId, endsAt, JSON.stringify(generateDefaultInvoices("pro", "month"))],
      );
      break;
    }

    case "enterprise_annual": {
      const endsAt = new Date(now);
      endsAt.setFullYear(endsAt.getFullYear() + 1);
      await client.query(
        `update organizations set plan_code = 'enterprise', audit_retention_days = 3650, updated_at = now() where id = $1`,
        [input.organizationId],
      );
      await client.query(
        `insert into organization_billing_accounts (
           organization_id, subscription_status, billing_interval, current_period_ends_at, cancel_at_period_end,
           card_brand, card_last4, card_exp, invoices, updated_at
         ) values ($1, 'active', 'year', $2, false, 'mastercard', '8890', '09/29', $3, now())
         on conflict (organization_id) do update set
           subscription_status = 'active',
           billing_interval = 'year',
           current_period_ends_at = excluded.current_period_ends_at,
           cancel_at_period_end = false,
           card_brand = 'mastercard',
           card_last4 = '8890',
           card_exp = '09/29',
           invoices = excluded.invoices,
           updated_at = now()`,
        [input.organizationId, endsAt, JSON.stringify(generateDefaultInvoices("enterprise", "year"))],
      );
      break;
    }

    case "past_due": {
      const pastDueEndsAt = new Date(now);
      pastDueEndsAt.setDate(pastDueEndsAt.getDate() - 2); // 2 days past due
      const failedInvoice: MockInvoice = {
        id: "inv_failed_01",
        number: `INV-${now.getFullYear()}-DUE-992`,
        date: pastDueEndsAt.toISOString(),
        amountDue: 79,
        amountPaid: 0,
        status: "open",
        description: "Team Pro Monthly Renewal — Payment Attempt Failed (Card Expired/Declined)",
        planName: "Team Pro",
        periodStart: pastDueEndsAt.toISOString(),
        periodEnd: now.toISOString(),
      };
      await client.query(
        `update organizations set plan_code = 'pro', audit_retention_days = 365, updated_at = now() where id = $1`,
        [input.organizationId],
      );
      await client.query(
        `insert into organization_billing_accounts (
           organization_id, subscription_status, billing_interval, current_period_ends_at, cancel_at_period_end,
           card_brand, card_last4, card_exp, invoices, updated_at
         ) values ($1, 'past_due', 'month', $2, false, 'visa', '0002', '08/26', $3, now())
         on conflict (organization_id) do update set
           subscription_status = 'past_due',
           billing_interval = 'month',
           current_period_ends_at = excluded.current_period_ends_at,
           cancel_at_period_end = false,
           card_brand = 'visa',
           card_last4 = '0002',
           card_exp = '08/26',
           invoices = excluded.invoices,
           updated_at = now()`,
        [input.organizationId, pastDueEndsAt, JSON.stringify([failedInvoice, ...generateDefaultInvoices("pro", "month")])],
      );
      break;
    }

    case "canceled_grace": {
      const graceEndsAt = new Date(now);
      graceEndsAt.setDate(graceEndsAt.getDate() + 14); // 14 days remaining
      await client.query(
        `update organizations set plan_code = 'pro', audit_retention_days = 365, updated_at = now() where id = $1`,
        [input.organizationId],
      );
      await client.query(
        `insert into organization_billing_accounts (
           organization_id, subscription_status, billing_interval, current_period_ends_at, cancel_at_period_end,
           card_brand, card_last4, card_exp, invoices, updated_at
         ) values ($1, 'canceled', 'month', $2, true, 'visa', '4242', '12/28', $3, now())
         on conflict (organization_id) do update set
           subscription_status = 'canceled',
           billing_interval = 'month',
           current_period_ends_at = excluded.current_period_ends_at,
           cancel_at_period_end = true,
           card_brand = 'visa',
           card_last4 = '4242',
           card_exp = '12/28',
           invoices = excluded.invoices,
           updated_at = now()`,
        [input.organizationId, graceEndsAt, JSON.stringify(generateDefaultInvoices("pro", "month"))],
      );
      break;
    }

    case "paused_staging": {
      await client.query(
        `update organizations set plan_code = 'pro', audit_retention_days = 365, updated_at = now() where id = $1`,
        [input.organizationId],
      );
      await client.query(
        `insert into organization_billing_accounts (
           organization_id, subscription_status, billing_interval, cancel_at_period_end,
           card_brand, card_last4, card_exp, invoices, updated_at
         ) values ($1, 'paused', 'month', false, 'amex', '1005', '03/29', $2, now())
         on conflict (organization_id) do update set
           subscription_status = 'paused',
           cancel_at_period_end = false,
           card_brand = 'amex',
           card_last4 = '1005',
           card_exp = '03/29',
           updated_at = now()`,
        [input.organizationId, JSON.stringify(generateDefaultInvoices("pro", "month"))],
      );
      break;
    }

    case "pilot_reset": {
      await client.query(
        `update organizations set plan_code = 'pilot', audit_retention_days = 90, updated_at = now() where id = $1`,
        [input.organizationId],
      );
      await client.query(
        `insert into organization_billing_accounts (
           organization_id, subscription_status, billing_interval, current_period_ends_at, cancel_at_period_end,
           card_brand, card_last4, card_exp, invoices, updated_at
         ) values ($1, 'not_configured', 'month', null, false, 'visa', '4242', '12/28', '[]'::jsonb, now())
         on conflict (organization_id) do update set
           subscription_status = 'not_configured',
           billing_interval = 'month',
           current_period_ends_at = null,
           cancel_at_period_end = false,
           invoices = '[]'::jsonb,
           updated_at = now()`,
        [input.organizationId],
      );
      break;
    }
  }

  await appendAuditEvent(client, {
    organizationId: input.organizationId,
    requestId: null,
    eventType: "billing.test_scenario_simulated",
    actorType: "human",
    actorId: input.operatorId,
    payload: {
      scenarioKey: input.scenarioKey,
      detail: `Sandbox test scenario '${input.scenarioKey}' applied for QA and workflow evaluation.`,
    },
  });

  return getSubscriptionDetails(client, input.organizationId);
}
