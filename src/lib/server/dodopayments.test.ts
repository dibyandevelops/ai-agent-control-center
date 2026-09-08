import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import {
  getDodoPaymentsConfig,
  verifyDodoPaymentsWebhookSignature,
  resolveDodoProductId,
} from "./dodopayments-core";

describe("Dodo Payments Core Integration", () => {
  it("reads configuration with defaults", () => {
    const config = getDodoPaymentsConfig();
    expect(config).toBeDefined();
    expect(["test", "live"]).toContain(config.mode);
    expect(config.baseUrl).toBeTruthy();
    expect(config.productIds.proMonthly).toBeTruthy();
  });

  it("resolves product IDs correctly across tiers and billing intervals", () => {
    const config = getDodoPaymentsConfig();
    expect(resolveDodoProductId("pro", "month", config)).toBe(config.productIds.proMonthly);
    expect(resolveDodoProductId("pro", "year", config)).toBe(config.productIds.proAnnual);
    expect(resolveDodoProductId("enterprise", "month", config)).toBe(config.productIds.enterpriseMonthly);
    expect(resolveDodoProductId("enterprise", "year", config)).toBe(config.productIds.enterpriseAnnual);
  });

  it("verifies valid Standard Webhooks / Svix signatures", () => {
    const secret = "whsec_MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE";
    const secretKey = Buffer.from(secret.slice(6), "base64");
    const id = "msg_123456789";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify({ type: "subscription.active", data: { id: "sub_1" } });

    const toSign = `${id}.${timestamp}.${rawBody}`;
    const hmac = crypto.createHmac("sha256", secretKey).update(toSign).digest("base64");
    const signature = `v1,${hmac}`;

    const isValid = verifyDodoPaymentsWebhookSignature({
      rawBody,
      headers: {
        id,
        signature,
        timestamp,
      },
      secret,
    });

    expect(isValid).toBe(true);
  });

  it("rejects forged or expired webhook signatures", () => {
    const secret = "whsec_MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE";
    const id = "msg_123456789";
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify({ type: "subscription.active" });

    // Wrong signature
    expect(
      verifyDodoPaymentsWebhookSignature({
        rawBody,
        headers: { id, signature: "v1,invalid_sig", timestamp },
        secret,
      }),
    ).toBe(false);

    // Expired timestamp (1 hour ago)
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 3600).toString();
    const toSign = `${id}.${oldTimestamp}.${rawBody}`;
    const secretKey = Buffer.from(secret.slice(6), "base64");
    const hmac = crypto.createHmac("sha256", secretKey).update(toSign).digest("base64");

    expect(
      verifyDodoPaymentsWebhookSignature({
        rawBody,
        headers: { id, signature: `v1,${hmac}`, timestamp: oldTimestamp },
        secret,
      }),
    ).toBe(false);
  });
});
