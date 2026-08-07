import "server-only";
import { getServerEnv } from "./env";
import type { SecurityDigestNotificationPayload } from "./notification-outbox";

export async function sendSecurityDigestEmail(payload: SecurityDigestNotificationPayload) {
  const env = getServerEnv();
  if (!env.RESEND_API_KEY || !env.SECURITY_DIGEST_FROM || !env.SECURITY_DIGEST_TO) return { delivered: false, reason: "not_configured" };
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: env.SECURITY_DIGEST_FROM, to: env.SECURITY_DIGEST_TO.split(",").map((email) => email.trim()).filter(Boolean), subject: `SentinelOps security digest — ${payload.date}`, text: ["SentinelOps daily security digest", `Security events: ${payload.totalEvents}`, `MFA: ${payload.mfaEvents}`, `Sessions: ${payload.sessionEvents}`, `Credentials: ${payload.credentialEvents}`, `Identity: ${payload.identityEvents}`, "", ...(payload.highlights.length ? payload.highlights.map((item) => `• ${item}`) : ["No security events recorded in this period."])].join("\n") }) });
  return { delivered: response.ok, reason: response.ok ? "delivered" : `http_${response.status}` };
}
