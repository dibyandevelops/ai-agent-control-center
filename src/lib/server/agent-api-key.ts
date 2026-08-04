import { createHash, randomBytes } from "node:crypto";

const apiKeyPrefix = "sop_live_";
const visiblePrefixLength = 16;

export function generateAgentApiKey() {
  return `${apiKeyPrefix}${randomBytes(32).toString("base64url")}`;
}

export function hashAgentApiKey(apiKey: string) {
  return createHash("sha256").update(apiKey).digest("hex");
}

export function getAgentApiKeyPrefix(apiKey: string) {
  return apiKey.slice(0, visiblePrefixLength);
}

