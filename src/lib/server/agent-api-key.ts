import { createHash, randomBytes } from "node:crypto";

const apiKeyPrefix = "sop_live_";
const visiblePrefixLength = 16;

export const agentApiKeyExpirationOptions = [30, 60, 90, 180, 365] as const;
export type AgentApiKeyExpirationDays =
  (typeof agentApiKeyExpirationOptions)[number];
export const defaultAgentApiKeyExpirationDays: AgentApiKeyExpirationDays = 90;

export function generateAgentApiKey() {
  return `${apiKeyPrefix}${randomBytes(32).toString("base64url")}`;
}

export function hashAgentApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function getAgentApiKeyPrefix(apiKey: string) {
  return apiKey.slice(0, visiblePrefixLength);
}

export function isAgentApiKeyExpirationDays(
  value: number,
): value is AgentApiKeyExpirationDays {
  return agentApiKeyExpirationOptions.some((option) => option === value);
}

export function getAgentApiKeyExpiresAt(
  days: AgentApiKeyExpirationDays,
  now = new Date(),
) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1_000);
}

export function getAgentApiKeyStatus(
  revokedAt: Date | null,
  expiresAt: Date | null,
  now = Date.now(),
) {
  if (revokedAt) return "revoked" as const;
  if (expiresAt && expiresAt.getTime() <= now) return "expired" as const;
  return "active" as const;
}
