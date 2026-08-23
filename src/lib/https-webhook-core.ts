import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const httpsWebhookSecretPrefix = "swhsec_";
export const httpsWebhookSignatureHeader = "x-sentinelops-signature";
export const httpsWebhookTimestampHeader = "x-sentinelops-timestamp";
export const httpsWebhookIdHeader = "x-sentinelops-delivery-id";
export const httpsWebhookEventHeader = "x-sentinelops-event";
export const httpsWebhookSignatureToleranceSeconds = 5 * 60;

const blockedHostnames = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
  "kubernetes",
  "internal",
]);

export function webhookSignaturePayload(timestamp: string, body: string) {
  return `${timestamp}.${body}`;
}

export function signHttpsWebhookBody(input: {
  secret: string;
  timestamp: string;
  body: string;
}) {
  const digest = createHmac("sha256", input.secret)
    .update(webhookSignaturePayload(input.timestamp, input.body))
    .digest("hex");
  return `v1=${digest}`;
}

export function verifyHttpsWebhookSignature(input: {
  secret: string;
  timestamp: string;
  body: string;
  signature: string;
  nowSeconds?: number;
}) {
  const timestamp = Number(input.timestamp);
  if (!Number.isInteger(timestamp)) return false;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > httpsWebhookSignatureToleranceSeconds) return false;

  const expected = Buffer.from(
    signHttpsWebhookBody({
      secret: input.secret,
      timestamp: input.timestamp,
      body: input.body,
    }),
  );
  const provided = Buffer.from(input.signature);
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export function isPrivateOrReservedIp(address: string) {
  const mapped = address.toLowerCase().replace(/^::ffff:/, "");
  if (mapped === "::1" || mapped === "0.0.0.0") return true;

  const ipv4 = mapped.includes(":") ? null : mapped;
  if (ipv4) {
    const parts = ipv4.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return true;
    const [first, second] = parts;
    if (first === 0 || first === 10 || first === 127) return true;
    if (first === 169 && second === 254) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first === 192 && second === 168) return true;
    if (first === 100 && second >= 64 && second <= 127) return true;
    return false;
  }

  const ipv6 = address.toLowerCase();
  return (
    ipv6 === "::" ||
    ipv6.startsWith("fc") ||
    ipv6.startsWith("fd") ||
    ipv6.startsWith("fe80")
  );
}

export type WebhookDnsResolve = (
  hostname: string,
  options: { all: true },
) => Promise<Array<{ address: string; family: number }>>;

export async function assertPublicHttpsWebhookUrl(
  rawUrl: string,
  resolve: WebhookDnsResolve = (hostname, options) => lookup(hostname, options),
) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Webhook URL must be a valid HTTPS address.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Webhook destinations must use HTTPS.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Webhook URLs must not include credentials.");
  }
  if (parsed.port && parsed.port !== "443") {
    throw new Error("Webhook destinations may use only the standard HTTPS port.");
  }

  const hostname = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (
    blockedHostnames.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Webhook destinations cannot target localhost or internal hosts.");
  }

  if (isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new Error("Webhook destinations cannot target private or reserved addresses.");
    }
    return parsed.toString();
  }

  const records = await resolve(hostname, { all: true });
  if (records.length === 0 || records.some((record) => isPrivateOrReservedIp(record.address))) {
    throw new Error("Webhook URL could not be resolved to a public address.");
  }
  return parsed.toString();
}

export function httpsWebhookEnvelope(input: {
  deliveryId: string;
  organizationId: string;
  eventType: string;
  occurredAt: string;
  data: unknown;
}) {
  return {
    id: input.deliveryId,
    source: "sentinelops",
    type: input.eventType,
    time: input.occurredAt,
    organizationId: input.organizationId,
    data: input.data,
  };
}
