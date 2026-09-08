import crypto from "node:crypto";

export interface DodoPaymentsConfig {
  apiKey: string;
  webhookSecret: string;
  mode: "test" | "live";
  baseUrl: string;
  productIds: {
    proMonthly: string;
    proAnnual: string;
    enterpriseMonthly: string;
    enterpriseAnnual: string;
  };
}

export function getDodoPaymentsConfig(): DodoPaymentsConfig {
  const mode = (process.env.DODO_PAYMENTS_MODE || "test").toLowerCase() === "live" ? "live" : "test";
  const baseUrl =
    process.env.DODO_PAYMENTS_BASE_URL ||
    (mode === "live" ? "https://live.dodopayments.com" : "https://test.dodopayments.com");

  return {
    apiKey: process.env.DODO_PAYMENTS_API_KEY || "",
    webhookSecret: process.env.DODO_PAYMENTS_WEBHOOK_SECRET || "",
    mode,
    baseUrl,
    productIds: {
      proMonthly: process.env.DODO_PRO_MONTHLY_PRODUCT_ID || "pdt_pro_monthly",
      proAnnual: process.env.DODO_PRO_ANNUAL_PRODUCT_ID || "pdt_pro_annual",
      enterpriseMonthly: process.env.DODO_ENTERPRISE_MONTHLY_PRODUCT_ID || "pdt_ent_monthly",
      enterpriseAnnual: process.env.DODO_ENTERPRISE_ANNUAL_PRODUCT_ID || "pdt_ent_annual",
    },
  };
}

/**
 * Standard Webhooks / Svix timing-safe HMAC-SHA256 verification
 * Headers required: webhook-id, webhook-signature, webhook-timestamp
 */
export function verifyDodoPaymentsWebhookSignature(params: {
  rawBody: string;
  headers: {
    id?: string | null;
    signature?: string | null;
    timestamp?: string | null;
  };
  secret: string;
  toleranceSeconds?: number;
}): boolean {
  const { id, signature, timestamp } = params.headers;
  if (!id || !signature || !timestamp || !params.secret) {
    return false;
  }

  // Verify timestamp within tolerance window (default: 5 minutes)
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  const tolerance = params.toleranceSeconds ?? 300;
  if (Math.abs(now - ts) > tolerance) {
    return false;
  }

  let secretBuffer: Buffer;
  if (params.secret.startsWith("whsec_")) {
    try {
      secretBuffer = Buffer.from(params.secret.slice(6), "base64");
    } catch {
      secretBuffer = Buffer.from(params.secret, "utf-8");
    }
  } else {
    secretBuffer = Buffer.from(params.secret, "utf-8");
  }

  const toSign = `${id}.${timestamp}.${params.rawBody}`;
  const expectedSignature = crypto
    .createHmac("sha256", secretBuffer)
    .update(toSign)
    .digest("base64");

  // Signature can be comma-separated or space-separated list of "v1,<base64>"
  const items = signature.split(/\s+/);
  for (const item of items) {
    const parts = item.split(",");
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === "v1" && parts[i + 1]) {
        const candidate = Buffer.from(parts[i + 1]);
        const expected = Buffer.from(expectedSignature);
        if (candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)) {
          return true;
        }
      }
    }
  }

  // Fallback direct base64 check
  try {
    const directCandidate = Buffer.from(signature.replace(/^v1,/, ""));
    const expected = Buffer.from(expectedSignature);
    if (directCandidate.length === expected.length && crypto.timingSafeEqual(directCandidate, expected)) {
      return true;
    }
  } catch {
    // Ignore fallback decode errors
  }

  return false;
}

export function resolveDodoProductId(
  planCode: "pro" | "enterprise",
  billingInterval: "month" | "year",
  config: DodoPaymentsConfig,
): string {
  if (planCode === "enterprise") {
    return billingInterval === "year"
      ? config.productIds.enterpriseAnnual
      : config.productIds.enterpriseMonthly;
  }
  return billingInterval === "year"
    ? config.productIds.proAnnual
    : config.productIds.proMonthly;
}
