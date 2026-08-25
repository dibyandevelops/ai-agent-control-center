import { describe, expect, it } from "vitest";
import {
  createChargebeeHostedCheckoutPayload,
  getChargebeeConfig,
  mapChargebeePlanIdToPlanCode,
} from "./chargebee-core";

describe("Chargebee integration core", () => {
  it("resolves default configuration gracefully", () => {
    const config = getChargebeeConfig();
    expect(config.site).toBeDefined();
    expect(typeof config.isConfigured).toBe("boolean");
  });

  it("creates valid hosted checkout session payloads for Pro plan", () => {
    const session = createChargebeeHostedCheckoutPayload({
      organizationId: "org-123",
      organizationName: "Acme Corp",
      operatorEmail: "admin@acme.com",
      operatorName: "Jane Doe",
      planCode: "pro",
      billingInterval: "month",
    });

    expect(session.planCode).toBe("pro");
    expect(session.amount).toBe(79);
    expect(session.currency).toBe("USD");
    expect(session.hostedPageId).toContain("hp_cb_");
    expect(session.url).toContain("chargebee.com/pages/v3/");
  });

  it("creates valid annual checkout session with 20% discount", () => {
    const session = createChargebeeHostedCheckoutPayload({
      organizationId: "org-123",
      organizationName: "Acme Corp",
      operatorEmail: "admin@acme.com",
      operatorName: "Jane Doe",
      planCode: "pro",
      billingInterval: "year",
    });

    expect(session.amount).toBe(64);
    expect(session.billingInterval).toBe("year");
  });

  it("maps Chargebee plan IDs accurately to internal PlanCode", () => {
    expect(mapChargebeePlanIdToPlanCode("sentinel-pro-monthly")).toBe("pro");
    expect(mapChargebeePlanIdToPlanCode("sentinel-enterprise-annual")).toBe("enterprise");
    expect(mapChargebeePlanIdToPlanCode("sentinel-pilot-tier")).toBe("pilot");
  });
});
