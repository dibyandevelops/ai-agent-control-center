import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";

export async function GET() {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }

    const pool = getPool();
    const env = getServerEnv();
    const [agentsResult, approvalsResult, policiesResult, auditResult] =
      await Promise.all([
        pool.query<{
          id: string;
          name: string;
          owner_email: string;
          team: string;
          provider: string;
          status: "healthy" | "review" | "blocked";
          action_count: string;
          last_action: string | null;
          last_execution_status: string | null;
          last_seen_at: Date;
        }>(`
          select
            a.id,
            a.name,
            a.owner_email,
            a.team,
            a.provider,
            a.status,
            count(ar.id)::text as action_count,
            (
              select latest.action
              from action_requests latest
              where latest.agent_id = a.id
              order by latest.requested_at desc
              limit 1
            ) as last_action,
            (
              select latest.execution_status
              from action_requests latest
              where latest.agent_id = a.id
              order by latest.requested_at desc
              limit 1
            ) as last_execution_status,
            a.last_seen_at
          from agents a
          left join action_requests ar on ar.agent_id = a.id
          where a.organization_id = $1
          group by a.id
          order by a.last_seen_at desc
          limit 100
        `, [operator.organizationId]),
        pool.query<{
          id: string;
          agent_id: string;
          agent_name: string;
          action: string;
          resource: string;
          decision_reason: string;
          risk: "low" | "medium" | "high";
          owner_email: string;
          requested_at: Date;
        }>(`
          select
            ar.id,
            ar.agent_id,
            a.name as agent_name,
            ar.action,
            ar.resource,
            ar.decision_reason,
            ar.risk,
            a.owner_email,
            ar.requested_at
          from action_requests ar
          join agents a on a.id = ar.agent_id
          where ar.decision_status = 'pending'
            and ar.organization_id = $1
            and (ar.expires_at is null or ar.expires_at > now())
          order by ar.requested_at desc
          limit 100
        `, [operator.organizationId]),
        pool.query<{
          id: string;
          name: string;
          description: string;
          effect: "allow" | "approval" | "block";
          enabled: boolean;
          matches: string;
        }>(`
          select
            p.id,
            p.name,
            p.description,
            p.effect,
            p.enabled,
            count(ar.id)::text as matches
          from policies p
          left join action_requests ar
            on ar.policy_id = p.id
            and ar.requested_at >= now() - interval '7 days'
          where p.organization_id = $1
          group by p.id
          order by p.priority asc
        `, [operator.organizationId]),
        pool.query<{
          id: string;
          request_id: string | null;
          created_at: Date;
          agent_name: string | null;
          action: string | null;
          event_type: string;
          actor_id: string;
          payload: Record<string, unknown>;
        }>(`
          select
            ae.id::text,
            ae.request_id,
            ae.created_at,
            a.name as agent_name,
            ar.action,
            ae.event_type,
            ae.actor_id,
            ae.payload
          from audit_events ae
          left join action_requests ar on ar.id = ae.request_id
          left join agents a on a.id = ar.agent_id
          where ae.organization_id = $1
          order by ae.created_at desc, ae.id desc
          limit 100
        `, [operator.organizationId]),
      ]);

    const latestGitHubEvidence = auditResult.rows.find((row) => {
      const reference = row.payload.externalReference;
      return (
        row.payload.status === "succeeded" &&
        typeof reference === "string" &&
        reference.startsWith("https://github.com/")
      );
    });
    const githubTokenConfigured = Boolean(env.GITHUB_TOKEN);
    const githubRepositoryConfigured = Boolean(env.GITHUB_REPOSITORY);
    const githubConnected =
      githubTokenConfigured && githubRepositoryConfigured;
    const githubStatus = latestGitHubEvidence
      ? "verified"
      : githubConnected
        ? "configured"
        : githubTokenConfigured || githubRepositoryConfigured
          ? "attention"
          : "not_connected";

    return NextResponse.json({
      mode: "live",
      operator,
      agents: agentsResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: "Registered through the SentinelOps enforcement API.",
        owner: row.owner_email,
        team: row.team,
        status: row.status,
        provider: row.provider,
        permissions: ["Policy evaluated"],
        actions: Number(row.action_count),
        cost: 0,
        lastAction: row.last_action ?? "Agent registered",
        lastExecutionStatus: row.last_execution_status ?? "not_started",
        lastSeen: row.last_seen_at.toISOString(),
      })),
      approvals: approvalsResult.rows.map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        agentName: row.agent_name,
        request: row.action,
        resource: row.resource,
        context: row.decision_reason,
        risk: row.risk,
        requestedBy: row.owner_email,
        requestedAt: row.requested_at.toISOString(),
        status: "pending",
      })),
      policies: policiesResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        scope: "Live organization",
        mode:
          row.effect === "block"
            ? "Block"
            : row.effect === "approval"
              ? "Approval"
              : "Monitor",
        enabled: row.enabled,
        matches: Number(row.matches),
      })),
      audit: auditResult.rows.map((row) => {
        const status = String(row.payload.status ?? row.payload.decision ?? "");
        const candidateReference = row.payload.externalReference;
        const externalReference =
          typeof candidateReference === "string" &&
          candidateReference.startsWith("https://github.com/")
            ? candidateReference
            : null;
        return {
          id: row.id,
          requestId: row.request_id,
          time: row.created_at.toISOString(),
          agent: row.agent_name ?? "SentinelOps",
          action: row.action ?? row.event_type,
          result:
            status === "allowed"
              ? "Allowed"
              : status === "approved"
                ? "Approved"
                : status === "executing"
                  ? "Executing"
                  : status === "succeeded"
                    ? "Succeeded"
                    : status === "failed"
                      ? "Failed"
                      : status === "cancelled"
                        ? "Cancelled"
                : status === "blocked" || status === "denied"
                  ? "Blocked"
                  : "Changed",
          actor: row.actor_id,
          detail: String(
            row.payload.summary ?? row.payload.reason ?? row.event_type,
          ),
          externalReference,
        };
      }),
      integrations: [
        {
          id: "int-github",
          name: "GitHub",
          description:
            "Govern release creation and preserve execution evidence.",
          connected: githubConnected,
          category: "Engineering",
          events: latestGitHubEvidence
            ? "Governed draft verified"
            : githubConnected
              ? "Ready for validation"
              : "Not configured",
          status: githubStatus,
          repository: env.GITHUB_REPOSITORY,
          mode:
            env.GITHUB_DRY_RUN === "false"
              ? "Draft release"
              : "Read-only dry run",
          url: env.GITHUB_REPOSITORY
            ? `https://github.com/${env.GITHUB_REPOSITORY}`
            : null,
        },
        {
          id: "int-slack",
          name: "Slack",
          description: "Route approval requests to the configured workspace.",
          connected: Boolean(env.SLACK_APPROVAL_WEBHOOK_URL),
          category: "Communication",
          events: env.SLACK_APPROVAL_WEBHOOK_URL
            ? "Approval notifications enabled"
            : "Not configured",
          status: env.SLACK_APPROVAL_WEBHOOK_URL
            ? "configured"
            : "not_connected",
          mode: "Approval notifications",
          url: null,
        },
      ],
    });
  } catch (error) {
    return apiError(error);
  }
}
