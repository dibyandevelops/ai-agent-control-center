import "server-only";

import { getSentinelOpsPublicUrl, getServerEnv } from "./env";

export function passwordResetEmailConfigured() {
  const env = getServerEnv();
  return Boolean(env.RESEND_API_KEY && (env.ONBOARDING_EMAIL_FROM || env.SECURITY_DIGEST_FROM));
}

export async function sendPasswordResetEmail(input: {
  email: string;
  displayName: string;
  token: string;
}) {
  const env = getServerEnv();
  const from = env.ONBOARDING_EMAIL_FROM || env.SECURITY_DIGEST_FROM;
  if (!env.RESEND_API_KEY || !from) return { delivered: false, reason: "not_configured" };

  const url = `${getSentinelOpsPublicUrl()}/dashboard?resetToken=${encodeURIComponent(input.token)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: "Reset your SentinelOps password",
      text: [
        `Hi ${input.displayName},`,
        "",
        "We received a request to reset your password for SentinelOps.",
        "",
        `Reset password: ${url}`,
        "",
        "This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.",
      ].join("\n"),
    }),
  });

  return { delivered: response.ok, reason: response.ok ? "delivered" : `http_${response.status}` };
}
