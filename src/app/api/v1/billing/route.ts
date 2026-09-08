import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { getOrganizationPlan } from "@/lib/server/plan-limits";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { getSubscriptionDetails } from "@/lib/server/subscription-core";

export async function GET() {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }
    if (!operatorCan(operator.role, "manage_operators")) {
      return NextResponse.json(
        { error: "Admin role required." },
        { status: 403 },
      );
    }
    const pool = getPool();
    const client = await pool.connect();
    try {
      const [plan, usage, subscription] = await Promise.all([
        getOrganizationPlan(client, operator.organizationId),
        client.query<{ agents: string; repositories: string; pending_approvals: string }>(
          `select
             (select count(*) from agents where organization_id = $1)::text as agents,
             (select count(*) from github_app_repositories where organization_id = $1 and enabled = true)::text as repositories,
             (select count(*) from action_requests where organization_id = $1 and decision_status = 'pending' and (expires_at is null or expires_at > now()))::text as pending_approvals`,
          [operator.organizationId],
        ),
        getSubscriptionDetails(client, operator.organizationId),
      ]);

      const row = usage.rows[0];

      return NextResponse.json(
        {
          plan: {
            code: plan.code,
            name: plan.name,
            limits: {
              agents: plan.agents,
              repositories: plan.repositories,
              pendingApprovals: plan.pendingApprovals,
              auditRetentionDays: plan.auditRetentionDays,
            },
          },
          usage: {
            agents: Number(row.agents),
            repositories: Number(row.repositories),
            pendingApprovals: Number(row.pending_approvals),
          },
          billing: {
            enabled: true,
            status: subscription.status,
            currentPeriodEndsAt: subscription.currentPeriodEndsAt,
            message: "Self-serve enterprise subscription management is active.",
          },
          subscription,
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
