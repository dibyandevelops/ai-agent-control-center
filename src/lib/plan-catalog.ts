export type PlanCode = "pilot" | "enterprise";

export const planCatalog = {
  pilot: {
    name: "Pilot",
    agents: 5,
    repositories: 2,
    pendingApprovals: 20,
    auditRetentionDays: 90,
    httpsWebhooks: 3,
  },
  enterprise: {
    name: "Enterprise",
    agents: null,
    repositories: null,
    pendingApprovals: null,
    auditRetentionDays: 3650,
    httpsWebhooks: null,
  },
} as const;
