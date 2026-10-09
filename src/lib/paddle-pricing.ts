export type BillingInterval = "month" | "year";
export type PaidTierName = "Starter" | "Pro" | "Advanced";
export type PaddlePriceKey =
  | "starter_month"
  | "starter_year"
  | "pro_month"
  | "pro_year"
  | "advanced_month"
  | "advanced_year";

export interface Tier {
  name: PaidTierName;
  description: string;
  features: string[];
  priceId: { month: string; year: string };
  featured?: boolean;
}

export type PaddlePriceIds = Record<PaddlePriceKey, string>;

export const paddlePriceEnvironmentVariables: Record<PaddlePriceKey, string> = {
  starter_month: "PADDLE_STARTER_MONTHLY_PRICE_ID",
  starter_year: "PADDLE_STARTER_ANNUAL_PRICE_ID",
  pro_month: "PADDLE_PRO_MONTHLY_PRICE_ID",
  pro_year: "PADDLE_PRO_ANNUAL_PRICE_ID",
  advanced_month: "PADDLE_ADVANCED_MONTHLY_PRICE_ID",
  advanced_year: "PADDLE_ADVANCED_ANNUAL_PRICE_ID",
};

export function readPaddlePriceIds(readEnvironmentVariable: (name: string) => string | undefined): PaddlePriceIds {
  return Object.fromEntries(
    Object.entries(paddlePriceEnvironmentVariables).map(([key, variable]) => [
      key,
      readEnvironmentVariable(variable)?.trim() ?? "",
    ]),
  ) as PaddlePriceIds;
}

const tierDefinitions: Omit<Tier, "priceId">[] = [
  {
    name: "Starter",
    description: "The essentials for bringing a small agent team under control.",
    features: [
      "Up to 5 governed AI agents",
      "2 connected repositories",
      "20 pending human approvals",
      "90-day cryptographic audit history",
      "3 HTTPS webhook destinations",
    ],
  },
  {
    name: "Pro",
    description: "More oversight and room to scale production agent workflows.",
    features: [
      "Up to 25 governed AI agents",
      "10 connected repositories",
      "100 pending human approvals",
      "1-year cryptographic audit history",
      "10 HTTPS webhook destinations",
      "Multi-approver quorum and delegation",
      "Instant quarantine killswitch",
    ],
    featured: true,
  },
  {
    name: "Advanced",
    description: "Expanded governance for complex and regulated environments.",
    features: [
      "Unlimited governed AI agents and repositories",
      "Unlimited pending human approvals",
      "10-year immutable audit history",
      "Unlimited SIEM / SOAR webhooks",
      "SCIM 2.0 and SAML 2.0 SSO",
      "Dedicated private VPC gateway",
      "Custom SLA and dedicated solutions architect",
    ],
  },
];

export function getPricingTiers(priceIds: PaddlePriceIds): Tier[] {
  return tierDefinitions.map((tier) => {
    const key = tier.name.toLowerCase() as Lowercase<PaidTierName>;
    return {
      ...tier,
      priceId: {
        month: priceIds[`${key}_month` as PaddlePriceKey],
        year: priceIds[`${key}_year` as PaddlePriceKey],
      },
    };
  });
}
