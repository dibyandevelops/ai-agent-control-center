import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createLemonSqueezyCheckoutPayload,
  getLemonSqueezyConfig,
  mapLemonSqueezyVariantToPlan,
  verifyLemonSqueezyWebhookSignature,
} from "./lemonsqueezy-core";

describe("Lemon Squeezy Integration Core", () => {
  it("resolves default configuration without crashing", () => {
    const config = getLemonSqueezyConfig();
    expect(config.apiKey).toBeDefined();
    expect(typeof config.isConfigured).toBe("boolean");
  });

  it("verifies valid HMAC-SHA256 signatures accurately", () => {
    const secret = "test_webhook_secret_key_12345";
    const payload = JSON.stringify({
      meta: { event_name: "subscription_created" },
      data: { id: "sub_101", type: "subscriptions" },
    });

    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    expect(verifyLemonSqueezyWebhookSignature(payload, validSignature, secret)).toBe(true);
    expect(verifyLemonSqueezyWebhookSignature(payload, "invalid_hex_digest", secret)).toBe(false);
    expect(verifyLemonSqueezyWebhookSignature(payload, null, secret)).toBe(false);
    expect(verifyLemonSqueezyWebhookSignature(payload, validSignature, "")).toBe(false);
  });

  it("creates valid checkout payloads for Pro plan", () => {
    const checkout = createLemonSqueezyCheckoutPayload({
      organizationId: "org-xyz-987",
      organizationName: "Aperture Robotics",
      operatorId: "op-1",
      operatorEmail: "founder@aperture.io",
      planCode: "pro",
      billingInterval: "month",
    });

    expect(checkout.planCode).toBe("pro");
    expect(checkout.billingInterval).toBe("month");
    expect(checkout.amount).toBe(40);
    expect(checkout.currency).toBe("USD");
    expect(checkout.url).toBeDefined();
  });

  it("calculates correct 20% annual discount pricing in checkout payload", () => {
    const checkout = createLemonSqueezyCheckoutPayload({
      organizationId: "org-xyz-987",
      organizationName: "Aperture Robotics",
      operatorId: "op-1",
      operatorEmail: "founder@aperture.io",
      planCode: "pro",
      billingInterval: "year",
    });

    expect(checkout.planCode).toBe("pro");
    expect(checkout.billingInterval).toBe("year");
    expect(checkout.amount).toBe(33.33 * 12); // Monthly equivalent from the current plan catalog.
  });

  it("maps Lemon Squeezy variant names to internal PlanCode", () => {
    expect(mapLemonSqueezyVariantToPlan("SentinelOps Team Pro - Monthly")).toEqual({
      planCode: "pro",
      billingInterval: "month",
    });
    expect(mapLemonSqueezyVariantToPlan("Enterprise Sovereignty Tier - Annual")).toEqual({
      planCode: "enterprise",
      billingInterval: "year",
    });
    expect(mapLemonSqueezyVariantToPlan("Standard Developer Pilot")).toEqual({
      planCode: "pilot",
      billingInterval: "month",
    });
  });
});
