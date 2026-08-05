import "server-only";

import { formatGitHubAppLifecycleSlackText } from "./notification-outbox-core";
import {
  recordSlackDelivery,
  resolveSlackDeliveryTarget,
} from "./slack-connections";

async function postSlackText(organizationId: string, text: string) {
  const target = await resolveSlackDeliveryTarget(organizationId);
  if (!target) return { delivered: false, reason: "not_configured" };

  const response = await fetch(target.webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(5_000),
  });

  const result = {
    delivered: response.ok,
    reason: response.ok ? "delivered" : `http_${response.status}`,
  };
  await recordSlackDelivery({ connectionId: target.connectionId, ...result });
  return result;
}

export async function sendSlackConnectionTest(input: {
  organizationId: string;
  organizationName: string;
}) {
  return postSlackText(
    input.organizationId,
    [
      "SentinelOps — Slack connection verified",
      `Organization: ${input.organizationName}`,
      "Tenant routing: organization-scoped OAuth",
      "Status: Ready for governance and security alerts",
    ].join("\n"),
  );
}

export async function notifySlackOfApproval(input: {
  organizationId: string;
  requestId: string;
  agentName: string;
  action: string;
  resource: string;
  risk: string;
}) {
  return postSlackText(
    input.organizationId,
    [
      `SentinelOps approval required: ${input.action}`,
      `Agent: ${input.agentName}`,
      `Resource: ${input.resource}`,
      `Risk: ${input.risk}`,
      `Request: ${input.requestId}`,
    ].join("\n"),
  );
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
  return postSlackText(
    input.organizationId,
    [
      `SentinelOps — ${heading}`,
      `Policy: ${input.policyName} (v${input.versionNumber})`,
      `Requested by: ${input.requestedBy}`,
      `Deadline: ${input.expiresAt}`,
      `Activation request: ${input.requestId}`,
    ].join("\n"),
  );
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
  return postSlackText(
    input.organizationId,
    [
      `SentinelOps — automated release execution failed`,
      `Agent: ${input.agentName}`,
      `Action: ${input.action}`,
      `Resource: ${input.resource}`,
      `Attempt: ${input.attemptCount}`,
      `Reason: ${input.error}`,
      `Request: ${input.requestId}`,
    ].join("\n"),
  );
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
  return postSlackText(
    input.organizationId,
    [
      `SentinelOps — independent approval required to ${input.operation} GitHub draft`,
      `Release: ${input.resource}`,
      `Requested by: ${input.requestedBy}`,
      `Review deadline: ${input.expiresAt}`,
      `Governance request: ${input.governanceId}`,
      `Action evidence: ${input.requestId}`,
    ].join("\n"),
  );
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
  return postSlackText(
    input.organizationId,
    [
      `SentinelOps — ${input.severity.toUpperCase()} GitHub release governance incident`,
      `Mutation: ${input.eventAction} ${input.repository}@${input.tagName}`,
      `GitHub actor: @${input.actorLogin}`,
      `Reason: ${input.reason}`,
      `Incident: ${input.incidentId}`,
      ...(input.externalReference ? [`Evidence: ${input.externalReference}`] : []),
    ].join("\n"),
  );
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
  return postSlackText(
    input.organizationId,
    formatGitHubAppLifecycleSlackText(input),
  );
}
