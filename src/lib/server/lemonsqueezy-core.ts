import "server-only";

import crypto from "node:crypto";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";

export interface LemonSqueezyConfig {
  apiKey: string;
  storeId: string;
  webhookSecret: string;
  isConfigured: boolean;
}

export function getLemonSqueezyConfig(): LemonSqueezyConfig {
  const apiKey = process.env.LEMON_SQUEEZY_API_KEY || "";
  const storeId = process.env.LEMON_SQUEEZY_STORE_ID || "";
  const webhookSecret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || "";

  return {
    apiKey,
    storeId,
    webhookSecret,
    isConfigured: Boolean(apiKey && storeId),
  };
}

export function verifyLemonSqueezyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  try {
    const hmac = crypto.createHmac("sha256", secret);
    const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
    const signatureBuffer = Buffer.from(signature, "utf8");

    if (digest.length !== signatureBuffer.length) return false;
    return crypto.timingSafeEqual(digest, signatureBuffer);
  } catch {
    return false;
  }
}

export interface LemonSqueezyCheckoutPayloadInput {
  organizationId: string;
  organizationName: string;
  operatorId: string;
  operatorEmail: string;
  planCode: PlanCode;
  billingInterval: "month" | "year";
  redirectUrl?: string;
}

export interface LemonSqueezyCheckoutResult {
  url: string;
  planCode: PlanCode;
  billingInterval: "month" | "year";
  amount: number;
  currency: string;
  isLive: boolean;
}

export function createLemonSqueezyCheckoutPayload(
  input: LemonSqueezyCheckoutPayloadInput,
): LemonSqueezyCheckoutResult {
  const config = getLemonSqueezyConfig();
  const plan = planCatalog[input.planCode];
  const price = input.billingInterval === "year" ? plan.priceAnnual * 12 : plan.priceMonthly;

  const redirect =
    input.redirectUrl ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?settings=billing&upgraded=${input.planCode}`;

  // If live keys are configured, construct Lemon Squeezy checkout link with custom passthrough data
  if (config.isConfigured) {
    const checkoutUrl = new URL(`https://${config.storeId}.lemonsqueezy.com/buy/${input.planCode}-${input.billingInterval}`);
    checkoutUrl.searchParams.set("checkout[email]", input.operatorEmail);
    checkoutUrl.searchParams.set("checkout[custom][organization_id]", input.organizationId);
    checkoutUrl.searchParams.set("checkout[custom][operator_id]", input.operatorId);
    checkoutUrl.searchParams.set("checkout[custom][plan_code]", input.planCode);
    checkoutUrl.searchParams.set("checkout[custom][billing_interval]", input.billingInterval);
    checkoutUrl.searchParams.set("checkout[success_url]", redirect);

    return {
      url: checkoutUrl.toString(),
      planCode: input.planCode,
      billingInterval: input.billingInterval,
      amount: price,
      currency: "USD",
      isLive: true,
    };
  }

  // Graceful local test / sandbox simulation URL
  const mockParams = new URLSearchParams({
    plan: input.planCode,
    interval: input.billingInterval,
    org: input.organizationId,
    amount: String(price),
  });

  return {
    url: `/api/v1/billing/lemonsqueezy/checkout?${mockParams.toString()}`,
    planCode: input.planCode,
    billingInterval: input.billingInterval,
    amount: price,
    currency: "USD",
    isLive: false,
  };
}

export function mapLemonSqueezyVariantToPlan(variantNameOrId: string): {
  planCode: PlanCode;
  billingInterval: "month" | "year";
} {
  const normalized = variantNameOrId.toLowerCase();
  if (normalized.includes("enterprise")) {
    return {
      planCode: "enterprise",
      billingInterval: normalized.includes("annual") || normalized.includes("year") ? "year" : "month",
    };
  }
  if (normalized.includes("pro")) {
    return {
      planCode: "pro",
      billingInterval: normalized.includes("annual") || normalized.includes("year") ? "year" : "month",
    };
  }
  return { planCode: "pilot", billingInterval: "month" };
}
