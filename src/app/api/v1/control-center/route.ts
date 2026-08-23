import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";
import { listOrganizationGitHubConnections } from "@/lib/server/github-connections";
import { listOrganizationSlackConnections } from "@/lib/server/slack-connections";
import { listOrganizationHttpsWebhooks } from "@/lib/server/https-webhooks";
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
      releaseGovernanceResult,
      githubDriftResult,
      notificationOutboxResult,
      githubConnections,
      slackConnections,
      httpsWebhooks,
    ] =
      await Promise.all([
        pool.query<{
          id: string;
          name: string;
          owner_email: string;
          team: string;
          provider: string;
          status: "healthy" | "review" | "blocked" | "quarantined";
          quarantined_at: Date | null;
          quarantined_by: string | null;
          quarantine_reason: string | null;
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
            a.quarantined_at,
            a.quarantined_by,
            a.quarantine_reason,
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
        pool.query<{
          id: string;
          action_request_id: string;
          agent_name: string;
          action: string;
          resource: string;
          operation: "publish" | "cancel";
          status: "pending" | "approved" | "executing" | "failed";
          request_reason: string;
          requested_by_operator_id: string;
          requested_by_email: string;
          requested_at: Date;
          expires_at: Date;
          reviewed_by_email: string | null;
          reviewed_at: Date | null;
          execution_attempt_count: number;
          execution_summary: string | null;
          execution_error_code: string | null;
          execution_completed_at: Date | null;
        }>(`
          select governance.id, governance.action_request_id,
                 agent.name as agent_name, action.action, action.resource,
                 governance.operation, governance.status,
                 governance.request_reason,
                 governance.requested_by_operator_id,
                 governance.requested_by_email, governance.requested_at,
                 governance.expires_at, governance.reviewed_by_email,
                 governance.reviewed_at, governance.execution_attempt_count,
                 governance.execution_summary, governance.execution_error_code,
                 governance.execution_completed_at
          from release_draft_governance_requests governance
          join action_requests action on action.id = governance.action_request_id
          join agents agent on agent.id = action.agent_id
          where governance.organization_id = $1
            and governance.status in ('pending', 'approved', 'executing', 'failed')
          order by
            case governance.status
              when 'pending' then 0
              when 'failed' then 1
              when 'approved' then 2
              else 3
            end,
            governance.expires_at asc,
            governance.requested_at desc
          limit 100
        `, [operator.organizationId]),
        pool.query<{
          id: string;
          action_request_id: string | null;
          repository: string;
          tag_name: string;
          event_action: string;
          severity: "high" | "critical";
          reason: string;
          actor_login: string;
          external_reference: string | null;
          detected_at: Date;
          status: "open" | "acknowledged";
          acknowledged_by_email: string | null;
          acknowledged_at: Date | null;
          acknowledgment_note: string | null;
        }>(`
          select id, action_request_id, repository, tag_name, event_action,
                 severity, reason, actor_login, external_reference, detected_at,
                 status, acknowledged_by_email, acknowledged_at,
                 acknowledgment_note
          from github_release_drift_incidents
          where organization_id = $1 and status in ('open', 'acknowledged')
          order by
            case severity when 'critical' then 0 else 1 end,
            detected_at desc
          limit 50
        `, [operator.organizationId]),
        pool.query<{
          pending: string;
          processing: string;
          delivered: string;
          dead: string;
        }>(
          `
            select
              count(*) filter (where status = 'pending')::text as pending,
              count(*) filter (where status = 'processing')::text as processing,
              count(*) filter (where status = 'delivered')::text as delivered,
              count(*) filter (where status = 'dead')::text as dead
            from notification_outbox
            where organization_id = $1
          `,
          [operator.organizationId],
        ),
        listOrganizationGitHubConnections(operator.organizationId),
        listOrganizationSlackConnections(operator.organizationId),
        listOrganizationHttpsWebhooks(operator.organizationId),
      ]);

    const latestGitHubEvidence = auditResult.rows.find((row) => {
      const reference = row.payload.externalReference;
      return (
        row.payload.status === "succeeded" &&
        typeof reference === "string" &&
        reference.startsWith("https://github.com/")
      );
    });
    const githubAppConfigured = Boolean(
      env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY,
    );
    const githubAppRegistered = githubConnections.some((connection) =>
      connection.status === "active" &&
      connection.repositories.some((repository) => repository.enabled)
    );
    const githubAppConnected = githubAppConfigured && githubAppRegistered;
    const githubConnected = githubAppConnected;
    const githubConnectionStatus = githubConnections[0]?.status;
    const githubRepositoryAccessRemoved =
      githubConnections.length > 0 &&
      githubConnectionStatus === "active" &&
      !githubAppRegistered;
    const githubWebhookConfigured = Boolean(
      env.GITHUB_WEBHOOK_SECRET && githubAppRegistered,
    );
    const activeCriticalContainments = githubDriftResult.rows.filter(
      (incident) => incident.severity === "critical",
    ).length;
    const githubStatus = githubDriftResult.rows.length > 0
      ? "attention"
      : githubRepositoryAccessRemoved
      ? "attention"
      : latestGitHubEvidence
      ? "verified"
      : githubConnected
        ? "configured"
        : githubConnections.length > 0
          ? "attention"
          : "not_connected";
    const notificationOutbox = notificationOutboxResult.rows[0];
    const queuedNotifications =
      Number(notificationOutbox?.pending ?? 0) +
      Number(notificationOutbox?.processing ?? 0);
    const deadNotifications = Number(notificationOutbox?.dead ?? 0);

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
        quarantinedAt: row.quarantined_at?.toISOString() ?? null,
        quarantinedBy: row.quarantined_by ?? null,
        quarantineReason: row.quarantine_reason ?? null,
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
      releaseGovernance: releaseGovernanceResult.rows.map((row) => ({
        id: row.id,
        requestId: row.action_request_id,
        agentName: row.agent_name,
        action: row.action,
        resource: row.resource,
        operation: row.operation,
        status: row.status,
        requestReason: row.request_reason,
        requestedByOperatorId: row.requested_by_operator_id,
        requestedBy: row.requested_by_email,
        requestedAt: row.requested_at.toISOString(),
        expiresAt: row.expires_at.toISOString(),
        reviewedBy: row.reviewed_by_email,
        reviewedAt: row.reviewed_at?.toISOString() ?? null,
        executionAttemptCount: row.execution_attempt_count,
        executionSummary: row.execution_summary,
        executionErrorCode: row.execution_error_code,
        executionCompletedAt: row.execution_completed_at?.toISOString() ?? null,
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
            "Govern releases and detect changes made outside SentinelOps.",
          connected: githubConnected,
          category: "Engineering",
          events: githubDriftResult.rows.length > 0
            ? `${githubDriftResult.rows.length} active governance incident${githubDriftResult.rows.length === 1 ? "" : "s"}`
            : githubConnectionStatus === "suspended"
            ? "Installation suspended"
            : githubConnectionStatus === "disconnected"
            ? "Installation disconnected"
            : githubRepositoryAccessRemoved
            ? "No repositories authorized"
            : latestGitHubEvidence
            ? "Governed draft verified"
            : githubConnected
              ? "Ready for validation"
              : "Not configured",
          status: githubStatus,
          repository: githubConnections[0]?.repositories[0]?.fullName,
          authenticationMode: githubAppRegistered ? "github_app" : "not_configured",
          githubConnections,
          mode:
            activeCriticalContainments > 0
              ? `Release containment active · ${activeCriticalContainments} target${activeCriticalContainments === 1 ? "" : "s"} frozen`
              : githubConnectionStatus === "suspended"
              ? "GitHub App installation suspended"
              : githubConnectionStatus === "disconnected"
              ? "GitHub App installation disconnected"
              : githubRepositoryAccessRemoved
              ? "GitHub repository access required"
              : githubAppRegistered && !githubAppConfigured
              ? "GitHub App credentials required"
              : env.RELEASE_EXECUTION_MODE === "github_draft"
              ? githubWebhookConfigured
                ? "Draft release · Drift protected"
                : "Draft release · Webhook required"
              : "Read-only dry run",
          url: githubConnections[0]?.repositories[0]?.fullName
            ? `https://github.com/${githubConnections[0].repositories[0].fullName}`
            : null,
          driftIncidents: githubDriftResult.rows.map((row) => ({
            id: row.id,
            requestId: row.action_request_id,
            repository: row.repository,
            tagName: row.tag_name,
            eventAction: row.event_action,
            severity: row.severity,
            reason: row.reason,
            actorLogin: row.actor_login,
            externalReference: row.external_reference,
            detectedAt: row.detected_at.toISOString(),
            status: row.status,
            acknowledgedBy: row.acknowledged_by_email,
            acknowledgedAt: row.acknowledged_at?.toISOString() ?? null,
            acknowledgmentNote: row.acknowledgment_note,
          })),
        },
        {
          id: "int-slack",
          name: "Slack",
          description: "Route action and policy activation reviews to the configured workspace.",
          connected: slackConnections.length > 0,
          category: "Communication",
          events: `${queuedNotifications} queued · ${deadNotifications} dead-lettered`,
          deadLetters: deadNotifications,
          status: deadNotifications > 0
            ? "attention"
            : slackConnections.some((connection) => connection.status === "active")
              ? "configured"
              : slackConnections.some((connection) => connection.status === "error")
                ? "attention"
                : "not_connected",
          mode: slackConnections.length > 0
            ? `${slackConnections.length} routed destination${slackConnections.length === 1 ? "" : "s"}`
            : "Approvals and escalations",
          url: null,
          slackConnections,
          slackAuthenticationMode: slackConnections.length > 0
            ? "oauth"
            : "not_configured",
        },
        {
          id: "int-https-webhooks",
          name: "HTTPS Webhooks",
          description: "Push signed governance and security events to SIEM or SOAR endpoints.",
          connected: httpsWebhooks.length > 0,
          category: "SIEM & Webhooks",
          events: httpsWebhooks.length > 0
            ? `${httpsWebhooks.length} destination${httpsWebhooks.length === 1 ? "" : "s"} configured`
            : "No destinations configured",
          status: httpsWebhooks.length > 0
            ? httpsWebhooks.some((webhook) => Boolean(webhook.lastError))
              ? "attention"
              : "configured"
            : "not_connected",
          mode: httpsWebhooks.length > 0
            ? `${httpsWebhooks.filter((webhook) => webhook.enabled).length} active / ${httpsWebhooks.length} total`
            : "HMAC-SHA256 Signed",
          url: null,
          httpsWebhooks,
        },
        {
          id: "int-python-sdk",
          name: "Python SDK",
          description: "Connect Python-based autonomous AI agents with native decorator guards.",
          connected: true,
          category: "Agent SDK",
          events: "Active client",
          status: "configured",
          mode: "Evaluation & Guarding",
          url: "/docs/PYTHON_INTEGRATION.md",
        },
      ],
    });
  } catch (error) {
    return apiError(error);
  }
}
