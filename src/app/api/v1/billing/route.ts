import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { getOrganizationPlan } from "@/lib/server/plan-limits";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";

export async function GET() {
  try {
    const operator = await getOperatorSession();
    if (!operator) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    if (!operatorCan(operator.role, "manage_operators")) return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    const pool = getPool();
    const [plan, usage, billing] = await Promise.all([
      pool.connect().then(async (client) => {
        try { return await getOrganizationPlan(client, operator.organizationId); }
        finally { client.release(); }
      }),
      pool.query<{ agents: string; repositories: string; pending_approvals: string }>(
        `select
           (select count(*) from agents where organization_id = $1)::text as agents,
           (select count(*) from github_app_repositories where organization_id = $1 and enabled = true)::text as repositories,
           (select count(*) from action_requests where organization_id = $1 and decision_status = 'pending' and (expires_at is null or expires_at > now()))::text as pending_approvals`,
        [operator.organizationId],
      ),
      pool.query<{ status: string; current_period_ends_at: Date | null }>(
        "select subscription_status as status, current_period_ends_at from organization_billing_accounts where organization_id = $1",
        [operator.organizationId],
      ),
    ]);
    const row = usage.rows[0];
    const account = billing.rows[0];
    return NextResponse.json({
      plan: {
        code: plan.code,
        name: plan.name,
        limits: { agents: plan.agents, repositories: plan.repositories, pendingApprovals: plan.pendingApprovals, auditRetentionDays: plan.auditRetentionDays },
      },
      usage: { agents: Number(row.agents), repositories: Number(row.repositories), pendingApprovals: Number(row.pending_approvals) },
      billing: {
        enabled: false,
        status: account?.status ?? "not_configured",
        currentPeriodEndsAt: account?.current_period_ends_at?.toISOString() ?? null,
        message: "Billing is prepared but checkout remains disabled until SentinelOps enables Stripe for this workspace.",
      },
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return apiError(error);
  }
}
