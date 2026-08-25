import "server-only";

import type { PoolClient } from "pg";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";
import { appendAuditEvent } from "./audit";

export * from "./chargebee-core";

export async function applyChargebeeSubscriptionUpdate(
  client: PoolClient,
  input: {
    organizationId: string;
    planCode: PlanCode;
    subscriptionId: string;
    customerId: string;
    status: string;
    currentPeriodEndsAt?: Date;
    actorEmail: string;
  },
) {
  const plan = planCatalog[input.planCode];

  // Update organization plan and retention
  await client.query(
    `update organizations
     set plan_code = $1,
         audit_retention_days = $2,
         updated_at = now()
     where id = $3`,
    [input.planCode, plan.auditRetentionDays, input.organizationId],
  );

  // Update or insert billing record
  await client.query(
    `insert into organization_billing_accounts (
       organization_id,
       stripe_customer_id,
       stripe_subscription_id,
       subscription_status,
       plan_tier,
       current_period_ends_at,
       updated_at
     ) values ($1, $2, $3, $4, $5, $6, now())
     on conflict (organization_id) do update set
       stripe_customer_id = excluded.stripe_customer_id,
       stripe_subscription_id = excluded.stripe_subscription_id,
       subscription_status = excluded.subscription_status,
       plan_tier = excluded.plan_tier,
       current_period_ends_at = excluded.current_period_ends_at,
       updated_at = now()`,
    [
      input.organizationId,
      input.customerId,
      input.subscriptionId,
      input.status,
      input.planCode,
      input.currentPeriodEndsAt ?? null,
    ],
  );

  // Append immutable audit log
  await appendAuditEvent(client, {
    organizationId: input.organizationId,
    requestId: null,
    eventType: "billing.subscription.updated",
    actorType: "system",
    actorId: input.actorEmail,
    payload: {
      action: "billing.subscription.updated",
      resource: `plan/${input.planCode}`,
      detail: `Chargebee subscription ${input.subscriptionId} activated for ${plan.name} (${input.status}). Limits updated: ${plan.agents ?? "unlimited"} agents, ${plan.auditRetentionDays} days retention.`,
      planCode: input.planCode,
      subscriptionId: input.subscriptionId,
      customerId: input.customerId,
      gateway: "chargebee",
      auditRetentionDays: plan.auditRetentionDays,
    },
  });
}
