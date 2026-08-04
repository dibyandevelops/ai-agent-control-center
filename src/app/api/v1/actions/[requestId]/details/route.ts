import { NextRequest, NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";

function safeGitHubReference(value: unknown) {
  return typeof value === "string" && value.startsWith("https://github.com/")
    ? value
    : null;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }

    const { requestId } = await context.params;
    const pool = getPool();
    const [requestResult, timelineResult] = await Promise.all([
      pool.query<{
        id: string;
        action: string;
        resource: string;
        environment: "development" | "staging" | "production";
        risk: "low" | "medium" | "high";
        context: Record<string, unknown>;
        decision_status: "allowed" | "pending" | "approved" | "denied" | "blocked";
        decision_reason: string;
        decided_by: string | null;
        decided_at: Date | null;
        requested_at: Date;
        execution_status: "not_started" | "executing" | "succeeded" | "failed" | "cancelled";
        execution_summary: string | null;
        execution_error_code: string | null;
        execution_started_at: Date | null;
        execution_completed_at: Date | null;
        execution_external_reference: string | null;
        agent_name: string;
        owner_email: string;
        team: string;
        provider: string;
        policy_name: string | null;
      }>(
        `
          select
            ar.id,
            ar.action,
            ar.resource,
            ar.environment,
            ar.risk,
            ar.context,
            ar.decision_status,
            ar.decision_reason,
            ar.decided_by,
            ar.decided_at,
            ar.requested_at,
            ar.execution_status,
            ar.execution_summary,
            ar.execution_error_code,
            ar.execution_started_at,
            ar.execution_completed_at,
            ar.execution_external_reference,
            a.name as agent_name,
            a.owner_email,
            a.team,
            a.provider,
            coalesce(pv.name, p.name) as policy_name
          from action_requests ar
          join agents a on a.id = ar.agent_id
          left join policies p on p.id = ar.policy_id
          left join policy_versions pv on pv.id = ar.policy_version_id
          where ar.id = $1
            and ar.organization_id = $2
          limit 1
        `,
        [requestId, operator.organizationId],
      ),
      pool.query<{
        id: string;
        created_at: Date;
        event_type: string;
        actor_type: "agent" | "policy" | "human" | "system";
        actor_id: string;
        payload: Record<string, unknown>;
      }>(
        `
          select
            id::text,
            created_at,
            event_type,
            actor_type,
            actor_id,
            payload
          from audit_events
          where request_id = $1
            and organization_id = $2
          order by id asc
        `,
        [requestId, operator.organizationId],
      ),
    ]);

    const row = requestResult.rows[0];
    if (!row) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    return NextResponse.json({
      requestId: row.id,
      action: row.action,
      resource: row.resource,
      environment: row.environment,
      risk: row.risk,
      requestedAt: row.requested_at.toISOString(),
      context: row.context,
      agent: {
        name: row.agent_name,
        owner: row.owner_email,
        team: row.team,
        provider: row.provider,
      },
      decision: {
        status: row.decision_status,
        reason: row.decision_reason,
        policyName: row.policy_name,
        decidedBy: row.decided_by,
        decidedAt: row.decided_at?.toISOString() ?? null,
      },
      execution: {
        status: row.execution_status,
        summary: row.execution_summary,
        errorCode: row.execution_error_code,
        startedAt: row.execution_started_at?.toISOString() ?? null,
        completedAt: row.execution_completed_at?.toISOString() ?? null,
        externalReference: safeGitHubReference(
          row.execution_external_reference,
        ),
      },
      timeline: timelineResult.rows.map((event) => ({
        id: event.id,
        time: event.created_at.toISOString(),
        eventType: event.event_type,
        actorType: event.actor_type,
        actor: event.actor_id,
        status: String(event.payload.status ?? event.payload.decision ?? "changed"),
        detail: String(
          event.payload.summary ??
            event.payload.reason ??
            event.event_type,
        ),
        externalReference: safeGitHubReference(
          event.payload.externalReference,
        ),
      })),
    });
  } catch (error) {
    return apiError(error);
  }
}
