import { planCatalog, type PlanCode } from "../plan-catalog";

export interface ChargebeeConfig {
  site: string;
  apiKey: string;
  publishableKey?: string;
  isConfigured: boolean;
}

export function getChargebeeConfig(): ChargebeeConfig {
  const site = process.env.CHARGEBEE_SITE || "sentinelops-sandbox";
  const apiKey = process.env.CHARGEBEE_API_KEY || "";
  const publishableKey = process.env.NEXT_PUBLIC_CHARGEBEE_PUBLISHABLE_KEY;
  return {
    site,
    apiKey,
    publishableKey,
    isConfigured: Boolean(apiKey && apiKey !== ""),
  };
}

export interface ChargebeeCheckoutSessionInput {
  organizationId: string;
  organizationName: string;
  operatorEmail: string;
  operatorName: string;
  planCode: PlanCode;
  billingInterval: "month" | "year";
  coupon?: string;
  returnUrl?: string;
}

export interface ChargebeeCheckoutSessionResult {
  hostedPageId: string;
  url: string;
  planCode: PlanCode;
  planName: string;
  amount: number;
  currency: string;
  billingInterval: "month" | "year";
  expiresAt: string;
}

export function createChargebeeHostedCheckoutPayload(
  input: ChargebeeCheckoutSessionInput,
): ChargebeeCheckoutSessionResult {
  const plan = planCatalog[input.planCode];
  const price = input.billingInterval === "year" ? plan.priceAnnual : plan.priceMonthly;
  const config = getChargebeeConfig();
  const hostedPageId = `hp_cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Hosted page URL for Chargebee checkout
  const hostedUrl = `https://${config.site}.chargebee.com/pages/v3/${hostedPageId}`;

  return {
    hostedPageId,
    url: hostedUrl,
    planCode: input.planCode,
    planName: plan.name,
    amount: price,
    currency: "USD",
    billingInterval: input.billingInterval,
    expiresAt,
  };
}

export interface ChargebeeWebhookEvent {
  id: string;
  event_type:
    | "subscription_created"
    | "subscription_changed"
    | "subscription_cancelled"
    | "subscription_renewed"
    | "payment_succeeded"
    | "payment_failed";
  content?: {
    subscription?: {
      id: string;
      customer_id: string;
      plan_id: string;
      status: string;
      current_term_end?: number;
    };
    customer?: {
      id: string;
      email?: string;
      cf_organization_id?: string;
    };
  };
}

export function mapChargebeePlanIdToPlanCode(planId: string): PlanCode {
  if (planId.includes("enterprise")) return "enterprise";
  if (planId.includes("pro")) return "pro";
  return "pilot";
}
