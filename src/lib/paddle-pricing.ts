export interface Tier {
  name: "Starter" | "Pro" | "Advanced";
  description: string;
  features: string[];
  priceId: { month: string; year: string };
  featured?: boolean;
}

export const pricingTiers: Tier[] = [
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
    priceId: {
      month: "pri_01m3xps84v5bmeydfkge6qbkdk",
      year: "pri_01m3xpvj4jpbhm0qhx52zkz06k",
    },
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
    priceId: {
      month: "pri_01m3xpz1d5220bzss50bnjn9nq",
      year: "pri_01m3xq0tr47wh6j4j0s9n21hdk",
    },
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
    priceId: {
      month: "pri_01m3xq28y7h835zwh17zx2rk9t",
      year: "pri_01m3xq30amv6bb99cag5gr4r31",
    },
  },
];
