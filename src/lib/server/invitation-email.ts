import "server-only";

import { getSentinelOpsPublicUrl, getServerEnv } from "./env";

export function invitationEmailConfigured() {
  const env = getServerEnv();
  return Boolean(env.RESEND_API_KEY && (env.ONBOARDING_EMAIL_FROM || env.SECURITY_DIGEST_FROM));
}

export async function sendOperatorInvitationEmail(input: {
  email: string;
  organizationName: string;
  inviterEmail: string;
  role: string;
  token: string;
}) {
  const env = getServerEnv();
  const from = env.ONBOARDING_EMAIL_FROM || env.SECURITY_DIGEST_FROM;
  if (!env.RESEND_API_KEY || !from) return { delivered: false, reason: "not_configured" };

  const url = `${getSentinelOpsPublicUrl()}/get-started?invitation=${encodeURIComponent(input.token)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: `Join ${input.organizationName} on SentinelOps`,
      text: [
        `You have been invited by ${input.inviterEmail} to join ${input.organizationName} on SentinelOps as an ${input.role}.`,
        "",
        `Accept invitation: ${url}`,
        "",
        "This one-time invitation expires in 7 days. If you did not expect this invitation, you can safely ignore this email.",
      ].join("\n"),
    }),
  });

  return { delivered: response.ok, reason: response.ok ? "delivered" : `http_${response.status}` };
}
