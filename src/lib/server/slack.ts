import "server-only";

import { getServerEnv } from "./env";

export async function notifySlackOfApproval(input: {
  requestId: string;
  agentName: string;
  action: string;
  resource: string;
  risk: string;
}) {
  const webhookUrl = getServerEnv().SLACK_APPROVAL_WEBHOOK_URL;
  if (!webhookUrl) return { delivered: false, reason: "not_configured" };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      text: [
        `SentinelOps approval required: ${input.action}`,
        `Agent: ${input.agentName}`,
        `Resource: ${input.resource}`,
        `Risk: ${input.risk}`,
        `Request: ${input.requestId}`,
      ].join("\n"),
    }),
    signal: AbortSignal.timeout(5_000),
  });

  return {
    delivered: response.ok,
    reason: response.ok ? "delivered" : `http_${response.status}`,
  };
}
