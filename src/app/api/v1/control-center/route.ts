import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";
import type { PolicyActivationSimulation } from "@/lib/types";

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
    const [
      agentsResult,
      approvalsResult,
      policiesResult,
      auditResult,
      policyActivationsResult,
    ] =
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
          priority: number;
          enabled: boolean;
          conditions: { all: Array<{
            field: string;
            operator: "eq" | "in" | "gte" | "contains";
            value: string | number | boolean | Array<string | number | boolean>;
          }> };
          matches: string;
          active_version_number: number | null;
          latest_version_number: number;
          pending_request_id: string | null;
          pending_requested_by_operator_id: string | null;
          pending_requested_by_email: string | null;
          pending_requested_at: Date | null;
          pending_expires_at: Date | null;
        }>(`
          select
            p.id,
            latest.name,
            latest.description,
            latest.effect,
            latest.priority,
            p.enabled,
            latest.conditions,
            coalesce(stats.matches, 0)::text as matches,
            active.version_number as active_version_number,
            latest.version_number as latest_version_number,
            pending.id as pending_request_id,
            pending.requested_by_operator_id as pending_requested_by_operator_id,
            pending.requested_by_email as pending_requested_by_email,
            pending.requested_at as pending_requested_at,
            pending.expires_at as pending_expires_at
          from policies p
          join lateral (
            select *
            from policy_versions pv
            where pv.policy_id = p.id
            order by pv.version_number desc
            limit 1
          ) latest on true
          left join policy_versions active on active.id = p.active_version_id
          left join lateral (
            select *
            from policy_activation_requests par
            where par.policy_id = p.id
              and par.status = 'pending'
              and par.expires_at > now()
            limit 1
          ) pending on true
          left join lateral (
            select count(*) as matches
            from action_requests ar
            where ar.policy_id = p.id
              and ar.requested_at >= now() - interval '7 days'
          ) stats on true
          where p.organization_id = $1
          order by latest.priority asc, p.id asc
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
        pool.query<{
          id: string;
          policy_id: string;
          policy_name: string;
          version_id: string;
          version_number: number;
          effect: "allow" | "approval" | "block";
          description: string;
          priority: number;
          conditions: { all: Array<{
            field: string;
            operator: "eq" | "in" | "gte" | "contains";
            value: string | number | boolean | Array<string | number | boolean>;
          }> };
          requested_by_operator_id: string | null;
          requested_by_email: string;
          requested_at: Date;
          active_version_number: number | null;
          active_name: string | null;
          active_description: string | null;
          active_effect: "allow" | "approval" | "block" | null;
          active_priority: number | null;
          active_conditions: { all: Array<{
            field: string;
            operator: "eq" | "in" | "gte" | "contains";
            value: string | number | boolean | Array<string | number | boolean>;
          }> } | null;
          simulation_evidence: PolicyActivationSimulation;
          expires_at: Date;
          reminder_count: number;
          escalated_at: Date | null;
        }>(`
          select
            par.id,
            par.policy_id,
            pv.name as policy_name,
            par.version_id,
            pv.version_number,
            pv.effect,
            pv.description,
            pv.priority,
            pv.conditions,
            par.requested_by_operator_id,
            par.requested_by_email,
            par.requested_at,
            active.version_number as active_version_number,
            active.name as active_name,
            active.description as active_description,
            active.effect as active_effect,
            active.priority as active_priority,
            active.conditions as active_conditions,
            par.simulation_evidence,
            par.expires_at,
            par.reminder_count,
            par.escalated_at
          from policy_activation_requests par
          join policy_versions pv on pv.id = par.version_id
          join policies p on p.id = par.policy_id
          left join policy_versions active on active.id = p.active_version_id
          where par.organization_id = $1
            and par.status = 'pending'
            and par.expires_at > now()
          order by par.requested_at asc
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
        effect: row.effect,
        priority: row.priority,
        conditions: row.conditions.all,
        enabled: row.enabled,
        matches: Number(row.matches),
        activeVersionNumber: row.active_version_number,
        latestVersionNumber: row.latest_version_number,
        activationStatus: row.pending_request_id
          ? "pending"
          : row.enabled && row.active_version_number === row.latest_version_number
            ? "active"
            : "draft",
        pendingActivation: row.pending_request_id
          ? {
              id: row.pending_request_id,
              requestedByOperatorId: row.pending_requested_by_operator_id,
              requestedBy: row.pending_requested_by_email,
              requestedAt: row.pending_requested_at?.toISOString() ?? null,
              expiresAt: row.pending_expires_at?.toISOString() ?? null,
            }
          : null,
      })),
      policyActivations: policyActivationsResult.rows.map((row) => ({
        id: row.id,
        policyId: row.policy_id,
        policyName: row.policy_name,
        versionId: row.version_id,
        versionNumber: row.version_number,
        activeVersionNumber: row.active_version_number,
        effect: row.effect,
        requestedByOperatorId: row.requested_by_operator_id,
        requestedBy: row.requested_by_email,
        requestedAt: row.requested_at.toISOString(),
        expiresAt: row.expires_at.toISOString(),
        reminderCount: row.reminder_count,
        escalatedAt: row.escalated_at?.toISOString() ?? null,
        candidate: {
          versionNumber: row.version_number,
          name: row.policy_name,
          description: row.description,
          priority: row.priority,
          effect: row.effect,
          conditions: row.conditions.all,
        },
        active: row.active_version_number !== null && row.active_name !== null &&
          row.active_description !== null && row.active_effect !== null &&
          row.active_priority !== null && row.active_conditions
          ? {
              versionNumber: row.active_version_number,
              name: row.active_name,
              description: row.active_description,
              priority: row.active_priority,
              effect: row.active_effect,
              conditions: row.active_conditions.all,
            }
          : null,
        simulation: row.simulation_evidence,
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
          description: "Route action and policy activation reviews to the configured workspace.",
          connected: Boolean(env.SLACK_APPROVAL_WEBHOOK_URL),
          category: "Communication",
          events: env.SLACK_APPROVAL_WEBHOOK_URL
            ? "Approval and escalation notifications enabled"
            : "Not configured",
          status: env.SLACK_APPROVAL_WEBHOOK_URL
            ? "configured"
            : "not_connected",
          mode: "Approvals and escalations",
          url: null,
        },
      ],
    });
  } catch (error) {
    return apiError(error);
  }
}
