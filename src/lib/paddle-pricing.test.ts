import { describe, expect, it } from "vitest";
import {
  getPricingTiers,
  paddlePriceEnvironmentVariables,
  readPaddlePriceIds,
} from "./paddle-pricing";

describe("Paddle pricing configuration", () => {
  it("resolves all plan price IDs from the active environment", () => {
    const ids = readPaddlePriceIds((name) => `price-for-${name}`);
    const tiers = getPricingTiers(ids);

    expect(tiers.map((tier) => tier.name)).toEqual(["Starter", "Pro", "Advanced"]);
    expect(tiers[0].priceId).toEqual({
      month: "price-for-PADDLE_STARTER_MONTHLY_PRICE_ID",
      year: "price-for-PADDLE_STARTER_ANNUAL_PRICE_ID",
    });
    expect(tiers[1].priceId.month).toBe("price-for-PADDLE_PRO_MONTHLY_PRICE_ID");
    expect(tiers[2].priceId.year).toBe("price-for-PADDLE_ADVANCED_ANNUAL_PRICE_ID");
  });

  it("does not silently substitute IDs when a variable is missing", () => {
    const ids = readPaddlePriceIds(() => undefined);

    expect(Object.keys(paddlePriceEnvironmentVariables)).toHaveLength(6);
    expect(Object.values(ids)).toEqual(["", "", "", "", "", ""]);
  });
});
