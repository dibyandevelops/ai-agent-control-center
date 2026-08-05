import "server-only";

import { getServerEnv } from "./env";
import { formatGitHubAppLifecycleSlackText } from "./notification-outbox-core";

async function postSlackText(text: string) {
  const webhookUrl = getServerEnv().SLACK_APPROVAL_WEBHOOK_URL;
  if (!webhookUrl) return { delivered: false, reason: "not_configured" };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(5_000),
  });

  return {
    delivered: response.ok,
    reason: response.ok ? "delivered" : `http_${response.status}`,
  };
}

export async function notifySlackOfApproval(input: {
  requestId: string;
  agentName: string;
  action: string;
  resource: string;
  risk: string;
}) {
  return postSlackText(
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
  requestId: string;
  agentName: string;
  action: string;
  resource: string;
  error: string;
  attemptCount: number;
}) {
  return postSlackText(
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
  governanceId: string;
  requestId: string;
  operation: "publish" | "cancel";
  resource: string;
  requestedBy: string;
  expiresAt: string;
}) {
  return postSlackText(
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
  installationId: string;
  accountLogin: string;
  change: "suspended" | "disconnected" | "repository_access_removed";
  severity: "high" | "critical";
  actorLogin: string;
  repositories: string[];
  remediationUrl: string;
}) {
  return postSlackText(formatGitHubAppLifecycleSlackText(input));
}
