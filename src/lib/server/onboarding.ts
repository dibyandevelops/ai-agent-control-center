import "server-only";

import { appendAuditEvent } from "./audit";
import { withTransaction } from "./db";
import { ConflictError } from "./errors";
import { hashPassword } from "./password";
import { createOnboardingVerificationToken } from "./onboarding-email";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";

const defaultPolicies = [
  {
    name: "Block exports to unapproved destinations",
    description: "Blocks bulk exports when the target destination is not approved.",
    priority: 10,
    effect: "block",
    conditions: { all: [
      { field: "action", operator: "eq", value: "data.export" },
      { field: "context.destinationApproved", operator: "eq", value: false },
    ] },
  },
  {
    name: "Production changes require approval",
    description: "Requires a platform owner to approve production deployments and releases.",
    priority: 20,
    effect: "approval",
    conditions: { all: [
      { field: "environment", operator: "eq", value: "production" },
      { field: "action", operator: "in", value: ["deploy.release", "github.release.create"] },
    ] },
  },
  {
    name: "Large financial exports require approval",
    description: "Routes financial exports of at least 1,000 records to a human reviewer.",
    priority: 30,
    effect: "approval",
    conditions: { all: [
      { field: "action", operator: "eq", value: "data.export" },
      { field: "context.recordCount", operator: "gte", value: 1000 },
    ] },
  },
] as const;

function organizationSlug(name: string) {
  const normalized = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return normalized || "workspace";
}

export async function createSelfServiceOrganization(input: {
  organizationName: string;
  displayName: string;
  email: string;
  password: string;
  planCode?: PlanCode;
  billingInterval?: "month" | "year";
}) {
  const email = input.email.trim().toLowerCase();
  const domain = email.split("@")[1];
  const passwordHash = await hashPassword(input.password);
  const baseSlug = organizationSlug(input.organizationName.trim());
  const verification = createOnboardingVerificationToken();

  const planCode: PlanCode = (input.planCode && planCatalog[input.planCode]) ? input.planCode : "pilot";
  const billingInterval: "month" | "year" = input.billingInterval === "year" ? "year" : "month";
  const planConfig = planCatalog[planCode];
  const retentionDays = planConfig.auditRetentionDays;

  const created = await withTransaction(async (client) => {
    const existingOperator = await client.query<{ id: string }>(
      "select id from operators where email = $1 limit 1",
      [email],
    );
    if (existingOperator.rows[0]) {
      throw new ConflictError("This work email is already associated with a SentinelOps organization. Sign in instead.");
    }

    let created: { organizationId: string; operatorId: string; organizationName: string } | null = null;
    for (let suffix = 0; suffix < 20; suffix += 1) {
      const slug = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`;
      const organization = await client.query<{ id: string; name: string }>(
        `insert into organizations (name, slug, plan_code, audit_retention_days)
         values ($1, $2, $3, $4)
         on conflict (slug) do nothing returning id, name`,
        [input.organizationName.trim(), slug, planCode, retentionDays],
      );
      if (!organization.rows[0]) continue;
      const organizationId = organization.rows[0].id;

      // Initialize billing account with selected tier
      const periodEndsAt = new Date();
      periodEndsAt.setDate(periodEndsAt.getDate() + (billingInterval === "year" ? 365 : 30));
      await client.query(
        `insert into organization_billing_accounts (
           organization_id,
           provider,
           provider_customer_id,
           subscription_status,
           billing_interval,
           current_period_ends_at,
           updated_at
         ) values ($1, 'stripe', $2, $3, $4, $5, now())
         on conflict (organization_id) do nothing`,
        [
          organizationId,
          `cus_sentinel_${organizationId.slice(0, 8)}`,
          planCode === "pilot" ? "not_configured" : "active",
          billingInterval,
          planCode === "pilot" ? null : periodEndsAt,
        ],
      );

      await client.query(
        `insert into organization_identity_settings (organization_id, allowed_email_domains)
         values ($1, $2::text[])`,
        [organizationId, [domain]],
      );
      const operator = await client.query<{ id: string }>(
        `insert into operators (
           organization_id, email, display_name, role, password_hash,
           password_change_required, password_changed_at, status
         ) values ($1, $2, $3, 'admin', $4, false, now(), 'pending_verification') returning id`,
        [organizationId, email, input.displayName.trim(), passwordHash],
      );
      created = { organizationId, operatorId: operator.rows[0].id, organizationName: organization.rows[0].name };
      break;
    }
    if (!created) throw new ConflictError("Workspace name is unavailable. Please choose a different name.");

    await client.query(
      `insert into onboarding_email_verifications (operator_id, token_hash, expires_at)
       values ($1, $2, now() + interval '24 hours')`,
      [created.operatorId, verification.hash],
    );

    for (const policy of defaultPolicies) {
      const policyResult = await client.query<{ id: string }>(
        `insert into policies (organization_id, name, description, priority, effect, conditions)
         values ($1, $2, $3, $4, $5, $6::jsonb) returning id`,
        [created.organizationId, policy.name, policy.description, policy.priority, policy.effect, JSON.stringify(policy.conditions)],
      );
      const version = await client.query<{ id: string }>(
        `insert into policy_versions (
           organization_id, policy_id, version_number, name, description, priority,
           effect, conditions, change_type, created_by_operator_id, created_by_email
         ) values ($1, $2, 1, $3, $4, $5, $6, $7::jsonb, 'created', $8, $9) returning id`,
        [created.organizationId, policyResult.rows[0].id, policy.name, policy.description, policy.priority, policy.effect, JSON.stringify(policy.conditions), created.operatorId, email],
      );
      await client.query("update policies set active_version_id = $2 where id = $1", [policyResult.rows[0].id, version.rows[0].id]);
    }

    await appendAuditEvent(client, {
      organizationId: created.organizationId,
      requestId: null,
      eventType: "organization.created",
      actorType: "human",
      actorId: email,
      payload: { organizationName: created.organizationName, operatorId: created.operatorId, allowedEmailDomain: domain },
    });
    await appendAuditEvent(client, {
      organizationId: created.organizationId,
      requestId: null,
      eventType: "operator.provisioned",
      actorType: "human",
      actorId: email,
      payload: { operatorId: created.operatorId, role: "admin", source: "self_service", status: "pending_verification" },
    });
    return created;
  });
  return { ...created, verificationToken: verification.token };
}
