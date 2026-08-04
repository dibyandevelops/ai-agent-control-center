import { NextRequest, NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import type { PolicyConditions } from "@/lib/server/contracts";
import { getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ policyId: string }> },
) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }
    const { policyId } = await context.params;
    const policyResult = await getPool().query<{
      id: string;
      enabled: boolean;
      active_version_id: string | null;
    }>(
      `
        select id, enabled, active_version_id
        from policies
        where id = $1 and organization_id = $2
      `,
      [policyId, operator.organizationId],
    );
    const policy = policyResult.rows[0];
    if (!policy) {
      return NextResponse.json({ error: "Policy not found." }, { status: 404 });
    }

    const versionsResult = await getPool().query<{
      id: string;
      version_number: number;
      name: string;
      description: string;
      priority: number;
      effect: "allow" | "approval" | "block";
      conditions: PolicyConditions;
      change_type: "created" | "edited" | "rollback";
      source_version_id: string | null;
      created_by_email: string;
      created_at: Date;
      request_id: string | null;
      request_status: "pending" | "approved" | "rejected" | null;
      requested_by_email: string | null;
      reviewed_by_email: string | null;
      review_reason: string | null;
      requested_at: Date | null;
      reviewed_at: Date | null;
    }>(
      `
        select
          pv.id,
          pv.version_number,
          pv.name,
          pv.description,
          pv.priority,
          pv.effect,
          pv.conditions,
          pv.change_type,
          pv.source_version_id,
          pv.created_by_email,
          pv.created_at,
          review.id as request_id,
          review.status as request_status,
          review.requested_by_email,
          review.reviewed_by_email,
          review.review_reason,
          review.requested_at,
          review.reviewed_at
        from policy_versions pv
        left join lateral (
          select *
          from policy_activation_requests par
          where par.version_id = pv.id
          order by par.requested_at desc
          limit 1
        ) review on true
        where pv.policy_id = $1 and pv.organization_id = $2
        order by pv.version_number desc
      `,
      [policyId, operator.organizationId],
    );

    return NextResponse.json({
      policyId,
      enabled: policy.enabled,
      activeVersionId: policy.active_version_id,
      versions: versionsResult.rows.map((version) => ({
        id: version.id,
        versionNumber: version.version_number,
        name: version.name,
        description: version.description,
        priority: version.priority,
        effect: version.effect,
        conditions: version.conditions.all,
        changeType: version.change_type,
        sourceVersionId: version.source_version_id,
        createdBy: version.created_by_email,
        createdAt: version.created_at.toISOString(),
        active: version.id === policy.active_version_id && policy.enabled,
        activation: version.request_id
          ? {
              id: version.request_id,
              status: version.request_status,
              requestedBy: version.requested_by_email,
              requestedAt: version.requested_at?.toISOString() ?? null,
              reviewedBy: version.reviewed_by_email,
              reviewedAt: version.reviewed_at?.toISOString() ?? null,
              reason: version.review_reason,
            }
          : null,
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
