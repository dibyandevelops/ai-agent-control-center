import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getSentinelOpsPublicUrl, getServerEnv } from "./env";

export function createOnboardingVerificationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: createHash("sha256").update(token).digest("hex") };
}

export function hashOnboardingVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function onboardingEmailConfigured() {
  const env = getServerEnv();
  return Boolean(env.RESEND_API_KEY && (env.ONBOARDING_EMAIL_FROM || env.SECURITY_DIGEST_FROM));
}

export async function sendOnboardingVerificationEmail(input: { email: string; displayName: string; organizationName: string; token: string }) {
  const env = getServerEnv();
  const from = env.ONBOARDING_EMAIL_FROM || env.SECURITY_DIGEST_FROM;
  if (!env.RESEND_API_KEY || !from) return { delivered: false, reason: "not_configured" };
  const url = `${getSentinelOpsPublicUrl()}/api/v1/onboarding/verify?token=${encodeURIComponent(input.token)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject: `Verify your SentinelOps workspace — ${input.organizationName}`,
      text: [`Hi ${input.displayName},`, "", `Confirm ${input.email} to activate the SentinelOps workspace for ${input.organizationName}.`, "", `Verify email: ${url}`, "", "This one-time link expires in 24 hours. If you did not create this workspace, you can ignore this email."].join("\n"),
    }),
  });
  return { delivered: response.ok, reason: response.ok ? "delivered" : `http_${response.status}` };
}
