import { describe, expect, it } from "vitest";
import { planCatalog } from "../plan-catalog";

describe("commercial plan catalog", () => {
  it("keeps the pilot constrained and enterprise unbounded", () => {
    expect(planCatalog.pilot.agents).toBe(5);
    expect(planCatalog.pilot.repositories).toBe(2);
    expect(planCatalog.enterprise.agents).toBeNull();
    expect(planCatalog.enterprise.auditRetentionDays).toBe(3650);
  });
});
