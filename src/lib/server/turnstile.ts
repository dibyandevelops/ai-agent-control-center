import "server-only";

import { NextRequest } from "next/server";
import { shouldBypassTurnstile } from "@/lib/turnstile-host";
import { getServerEnv } from "./env";

type TurnstileResult =
  | { enabled: false; valid: true }
  | { enabled: true; valid: boolean; configured: boolean };

function getRequestAddress(request: NextRequest): string | undefined {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    undefined
  );
}

async function callTurnstileSiteverify(
  secret: string,
  token: string,
  remoteIp?: string,
): Promise<{ ok: boolean; success: boolean; errorCodes?: string[] }> {
  const body = new URLSearchParams({
    secret,
    response: token,
  });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const payload = (await response.json().catch(() => null)) as {
      success?: boolean;
      "error-codes"?: string[];
    } | null;

    return {
      ok: response.ok,
      success: payload?.success === true,
      errorCodes: payload?.["error-codes"],
    };
  } catch (error) {
    console.error("[Turnstile] Network error contacting Cloudflare siteverify", error);
    return { ok: false, success: false, errorCodes: ["network-error"] };
  }
}

export async function verifyTurnstile(
  request: NextRequest,
  token: string | undefined,
): Promise<TurnstileResult> {
  if (shouldBypassTurnstile(request.nextUrl.hostname, process.env.NODE_ENV)) {
    return { enabled: false, valid: true };
  }

  const env = getServerEnv();
  if (env.TURNSTILE_ENABLED !== "true") return { enabled: false, valid: true };
  if (!env.TURNSTILE_SECRET_KEY) return { enabled: true, valid: false, configured: false };
  if (!token) return { enabled: true, valid: false, configured: true };

  const remoteIp = getRequestAddress(request);

  // Attempt verification with remoteIp
  let verification = await callTurnstileSiteverify(env.TURNSTILE_SECRET_KEY, token, remoteIp);

  // Cloudflare docs: If remoteip causes false-negative mismatches behind CDNs/proxies,
  // retry without remoteip to prevent blocking legitimate enterprise users.
  if (!verification.success && remoteIp) {
    const retryWithoutIp = await callTurnstileSiteverify(env.TURNSTILE_SECRET_KEY, token);
    if (retryWithoutIp.success) {
      verification = retryWithoutIp;
    }
  }

  if (!verification.success) {
    console.warn("[Turnstile] Verification rejected by Cloudflare", {
      hostname: request.nextUrl.hostname,
      errorCodes: verification.errorCodes,
    });
  }

  return {
    enabled: true,
    configured: true,
    valid: verification.ok && verification.success,
  };
}
