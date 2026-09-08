import { describe, expect, it } from "vitest";
import { generateDefaultInvoices } from "./subscription-core";
import { planCatalog } from "@/lib/plan-catalog";

describe("Subscription Engine Core", () => {
  it("generates correct invoices for monthly and annual subscriptions", () => {
    const monthlyInvoices = generateDefaultInvoices("pro", "month");
    expect(monthlyInvoices.length).toBe(2);
    expect(monthlyInvoices[0].amountDue).toBe(planCatalog.pro.priceMonthly);
    expect(monthlyInvoices[0].status).toBe("paid");
    expect(monthlyInvoices[0].number).toMatch(/^INV-\d{4}-\d{2}-\d{3}$/);

    const annualInvoices = generateDefaultInvoices("enterprise", "year");
    expect(annualInvoices.length).toBe(2);
    expect(annualInvoices[0].amountDue).toBe(planCatalog.enterprise.priceAnnual * 12);
  });

  it("returns zero invoices for free pilot plan", () => {
    const pilotInvoices = generateDefaultInvoices("pilot", "month");
    expect(pilotInvoices).toEqual([]);
  });

  it("maintains consistent plan catalog tiers and limits", () => {
    expect(planCatalog.pilot.agents).toBe(5);
    expect(planCatalog.pro.agents).toBe(25);
    expect(planCatalog.enterprise.agents).toBeNull(); // unlimited

    expect(planCatalog.pro.auditRetentionDays).toBe(365);
    expect(planCatalog.enterprise.auditRetentionDays).toBe(3650);
  });
});
