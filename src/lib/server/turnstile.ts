import "server-only";

import { NextRequest } from "next/server";
import { shouldBypassTurnstile } from "@/lib/turnstile-host";
import { getServerEnv } from "./env";

type TurnstileResult =
  | { enabled: false; valid: true }
  | { enabled: true; valid: boolean; configured: boolean };

function getRequestAddress(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
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

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token,
  });
  const remoteIp = getRequestAddress(request);
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const payload = (await response.json().catch(() => null)) as { success?: boolean } | null;
    return { enabled: true, configured: true, valid: response.ok && payload?.success === true };
  } catch {
    return { enabled: true, configured: true, valid: false };
  }
}
