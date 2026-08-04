import "server-only";

import { getServerEnv } from "./env";

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
