import "server-only";

import type { PoolClient } from "pg";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";
import { ConflictError } from "./errors";

export type LimitResource = "agents" | "repositories" | "pending_approvals" | "https_webhooks";

const limitConfig: Record<LimitResource, { table: string; where: string; label: string; limitKey: "agents" | "repositories" | "pendingApprovals" | "httpsWebhooks" }> = {
  agents: {
    table: "agents",
    where: "",
    label: "registered agents",
    limitKey: "agents",
  },
  repositories: {
    table: "github_app_repositories",
    where: "and enabled = true",
    label: "connected repositories",
    limitKey: "repositories",
  },
  pending_approvals: {
    table: "action_requests",
    where: "and decision_status = 'pending' and (expires_at is null or expires_at > now())",
    label: "pending approvals",
    limitKey: "pendingApprovals",
  },
  https_webhooks: {
    table: "organization_https_webhooks",
    where: "and revoked_at is null",
    label: "HTTPS webhook destinations",
    limitKey: "httpsWebhooks",
  },
};

export async function getOrganizationPlan(
  client: PoolClient,
  organizationId: string,
) {
  const result = await client.query<{
    plan_code: PlanCode;
    audit_retention_days: number;
  }>(
    "select plan_code, audit_retention_days from organizations where id = $1",
    [organizationId],
  );
  const row = result.rows[0] ?? {
    plan_code: "pilot" as const,
    audit_retention_days: planCatalog.pilot.auditRetentionDays,
  };
  return {
    code: row.plan_code,
    ...planCatalog[row.plan_code],
    auditRetentionDays: row.audit_retention_days,
  };
}

export async function assertOrganizationLimit(
  client: PoolClient,
  input: { organizationId: string; resource: LimitResource; increment?: number },
) {
  const plan = await getOrganizationPlan(client, input.organizationId);
  const config = limitConfig[input.resource];
  const limit = plan[config.limitKey];
  if (limit === null) return plan;

  const count = await client.query<{ count: string }>(
    `select count(*)::text as count from ${config.table}
      where organization_id = $1 ${config.where}`,
    [input.organizationId],
  );
  if (Number(count.rows[0]?.count ?? 0) + (input.increment ?? 1) > limit) {
    throw new ConflictError(
      `${plan.name} plan limit reached: ${limit} ${config.label}. Contact SentinelOps to expand this limit.`,
    );
  }
  return plan;
}
