import "server-only";

import { formatGitHubAppLifecycleSlackText } from "./notification-outbox-core";
import {
  recordSlackDelivery,
  resolveSlackDeliveryTargets,
} from "./slack-connections";
import type { SlackEventType, SlackSeverity } from "./slack-routing-core";

async function postSlackText(input: {
  organizationId: string;
  eventType: SlackEventType;
  severity: SlackSeverity;
  text: string;
  connectionId?: string;
}) {
  const targets = await resolveSlackDeliveryTargets(input);
  if (targets.length === 0) return { delivered: false, reason: "not_configured", deliveredCount: 0 };

  const deliveries = await Promise.all(targets.map(async (target) => {
    const response = await fetch(target.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: input.text }),
      signal: AbortSignal.timeout(5_000),
    });
    const result = {
      delivered: response.ok,
      reason: response.ok ? "delivered" : `http_${response.status}`,
    };
    await recordSlackDelivery({ connectionId: target.connectionId, ...result });
    return result;
  }));
  const deliveredCount = deliveries.filter((delivery) => delivery.delivered).length;
  return {
    delivered: deliveredCount === deliveries.length,
    reason: deliveredCount === deliveries.length
      ? `delivered_${deliveredCount}`
      : `delivered_${deliveredCount}_of_${deliveries.length}`,
    deliveredCount,
  };
}

export async function sendSlackConnectionTest(input: {
  organizationId: string;
  organizationName: string;
  connectionId: string;
}) {
  return postSlackText({
    organizationId: input.organizationId,
    connectionId: input.connectionId,
    eventType: "action.approval_requested",
    severity: "info",
    text: [
      "SentinelOps — Slack connection verified",
      `Organization: ${input.organizationName}`,
      "Tenant routing: organization-scoped OAuth",
      "Status: Ready for governance and security alerts",
    ].join("\n"),
  });
}

export async function notifySlackOfApproval(input: {
  organizationId: string;
  requestId: string;
  agentName: string;
  action: string;
  resource: string;
  risk: "low" | "medium" | "high";
}) {
  return postSlackText({
    organizationId: input.organizationId,
    eventType: "action.approval_requested",
    severity: input.risk,
    text: [
      `SentinelOps approval required: ${input.action}`,
      `Agent: ${input.agentName}`,
      `Resource: ${input.resource}`,
      `Risk: ${input.risk}`,
      `Request: ${input.requestId}`,
    ].join("\n"),
  });
}

export async function notifySlackOfPolicyActivation(input: {
  organizationId: string;
  kind: "requested" | "reminder" | "escalation" | "expired";
  requestId: string;
  policyName: string;
  versionNumber: number;
  requestedBy: string;
  expiresAt: string;
}) {
  const heading =
    input.kind === "requested"
      ? "Policy activation review required"
      : input.kind === "reminder"
        ? "Policy activation review reminder"
        : input.kind === "escalation"
          ? "ESCALATION: policy activation still awaiting review"
          : "Policy activation request expired";
  return postSlackText({
    organizationId: input.organizationId,
    eventType: "policy.activation",
    severity: input.kind === "requested" || input.kind === "reminder" ? "medium" : "high",
    text: [
      `SentinelOps — ${heading}`,
      `Policy: ${input.policyName} (v${input.versionNumber})`,
      `Requested by: ${input.requestedBy}`,
      `Deadline: ${input.expiresAt}`,
      `Activation request: ${input.requestId}`,
    ].join("\n"),
  });
}

export async function notifySlackOfReleaseExecutionFailure(input: {
  organizationId: string;
  requestId: string;
  agentName: string;
  action: string;
  resource: string;
  error: string;
  attemptCount: number;
}) {
  return postSlackText({
    organizationId: input.organizationId,
    eventType: "action.execution_failed",
    severity: "high",
    text: [
      `SentinelOps — automated release execution failed`,
      `Agent: ${input.agentName}`,
      `Action: ${input.action}`,
      `Resource: ${input.resource}`,
      `Attempt: ${input.attemptCount}`,
      `Reason: ${input.error}`,
      `Request: ${input.requestId}`,
    ].join("\n"),
  });
}

export async function notifySlackOfReleaseGovernance(input: {
  organizationId: string;
  governanceId: string;
  requestId: string;
  operation: "publish" | "cancel";
  resource: string;
  requestedBy: string;
  expiresAt: string;
}) {
  return postSlackText({
    organizationId: input.organizationId,
    eventType: "release.draft_governance_requested",
    severity: "high",
    text: [
      `SentinelOps — independent approval required to ${input.operation} GitHub draft`,
      `Release: ${input.resource}`,
      `Requested by: ${input.requestedBy}`,
      `Review deadline: ${input.expiresAt}`,
      `Governance request: ${input.governanceId}`,
      `Action evidence: ${input.requestId}`,
    ].join("\n"),
  });
}

export async function notifySlackOfGitHubDrift(input: {
  organizationId: string;
  incidentId: string;
  repository: string;
  tagName: string;
  eventAction: string;
  severity: "high" | "critical";
  actorLogin: string;
  reason: string;
  externalReference: string | null;
}) {
  return postSlackText({
    organizationId: input.organizationId,
    eventType: "github.release_drift_detected",
    severity: input.severity,
    text: [
      `SentinelOps — ${input.severity.toUpperCase()} GitHub release governance incident`,
      `Mutation: ${input.eventAction} ${input.repository}@${input.tagName}`,
      `GitHub actor: @${input.actorLogin}`,
      `Reason: ${input.reason}`,
      `Incident: ${input.incidentId}`,
      ...(input.externalReference ? [`Evidence: ${input.externalReference}`] : []),
    ].join("\n"),
  });
}

export async function notifySlackOfGitHubAppLifecycle(input: {
  organizationId: string;
  installationId: string;
  accountLogin: string;
  change: "suspended" | "disconnected" | "repository_access_removed";
  severity: "high" | "critical";
  actorLogin: string;
  repositories: string[];
  remediationUrl: string;
}) {
  return postSlackText({
    organizationId: input.organizationId,
    eventType: "github.app_lifecycle_alert",
    severity: input.severity,
    text: formatGitHubAppLifecycleSlackText(input),
  });
}

export async function notifySlackOfSecurityDigest(input: {
  organizationId: string; date: string; totalEvents: number; mfaEvents: number;
  sessionEvents: number; credentialEvents: number; identityEvents: number; highlights: string[];
}) {
  return postSlackText({ organizationId: input.organizationId, eventType: "security.daily_digest", severity: "info", text: [
    `SentinelOps — daily security digest (${input.date})`,
    `Security events: ${input.totalEvents}`,
    `MFA: ${input.mfaEvents} · Sessions: ${input.sessionEvents} · Credentials: ${input.credentialEvents} · Identity: ${input.identityEvents}`,
    ...(input.highlights.length ? ["Recent activity:", ...input.highlights.map((item) => `• ${item}`)] : ["No security events recorded in this period."]),
  ].join("\n") });
}
