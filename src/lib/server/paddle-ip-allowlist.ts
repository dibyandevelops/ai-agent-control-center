import "server-only";

import { getForwardedIpv4, isIpv4InCidrs } from "./paddle-ip-allowlist-core";

type IpList = { cidrs: string[]; expiresAt: number };
let cachedIpList: IpList | null = null;
let loadingIpList: Promise<string[]> | null = null;
const cacheDurationMs = 5 * 60 * 1_000;

async function fetchPaddleCidrs(): Promise<string[]> {
  const environment = process.env.PADDLE_ENVIRONMENT;
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error("PADDLE_ENVIRONMENT must be explicitly set to sandbox or production.");
  }
  const baseUrl = environment === "sandbox"
    ? "https://sandbox-api.paddle.com"
    : "https://api.paddle.com";
  const response = await fetch(`${baseUrl}/ips`, {
    cache: "no-store",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(3_000),
  });
  if (!response.ok) throw new Error(`Paddle IP endpoint returned HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  const cidrs = (payload as { data?: { ipv4_cidrs?: unknown } })?.data?.ipv4_cidrs;
  if (!Array.isArray(cidrs) || cidrs.length === 0 || !cidrs.every((value) => typeof value === "string" && /^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/.test(value))) {
    throw new Error("Paddle IP endpoint returned an invalid ipv4_cidrs list.");
  }
  return cidrs as string[];
}

async function getPaddleCidrs(): Promise<string[]> {
  if (cachedIpList && Date.now() < cachedIpList.expiresAt) return cachedIpList.cidrs;
  if (!loadingIpList) {
    loadingIpList = fetchPaddleCidrs().then((cidrs) => {
      cachedIpList = { cidrs, expiresAt: Date.now() + cacheDurationMs };
      return cidrs;
    }).finally(() => {
      loadingIpList = null;
    });
  }
  return loadingIpList;
}

export async function checkPaddleWebhookSource(headers: Headers): Promise<
  | { allowed: true }
  | { allowed: false; reason: "unavailable" | "missing_or_invalid_ip" | "not_allowlisted" }
> {
  const sourceIp = getForwardedIpv4(headers);
  if (!sourceIp) return { allowed: false, reason: "missing_or_invalid_ip" };
  try {
    const cidrs = await getPaddleCidrs();
    return isIpv4InCidrs(sourceIp, cidrs)
      ? { allowed: true }
      : { allowed: false, reason: "not_allowlisted" };
  } catch (error) {
    console.error("[Paddle webhook IP allowlist unavailable]", error);
    return { allowed: false, reason: "unavailable" };
  }
}
