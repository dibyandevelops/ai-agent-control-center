import { createHash, randomBytes } from "node:crypto";

export function normalizeEmailDomain(value: string) {
  const normalized = value.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(normalized)) {
    throw new Error("Enter a valid company email domain, for example example.com.");
  }
  return normalized;
}

export function normalizeAllowedDomains(domains: string[]) {
  return [...new Set(domains.map(normalizeEmailDomain))].sort();
}

export function emailMatchesAllowedDomains(email: string, domains: string[]) {
  if (domains.length === 0) return true;
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex < 1) return false;
  return domains.includes(normalized.slice(atIndex + 1));
}

export function createScimBearerToken() {
  return `sos_scim_${randomBytes(32).toString("base64url")}`;
}

export function hashScimBearerToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function scimTokenHint(token: string) {
  return token.slice(-6);
}
