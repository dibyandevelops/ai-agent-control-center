import "server-only";

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { withTransaction } from "./db";

const limit = 5;
const windowSeconds = 15 * 60;

function hashKey(value: string) {
  return createHash("sha256").update(`sentinelops:onboarding:${value}`).digest("hex");
}

function requestAddress(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwarded || realIp || "unavailable";
}

async function consume(key: string) {
  return withTransaction(async (client) => {
    const result = await client.query<{ attempt_count: number; window_started_at: Date }>(
      `insert into onboarding_rate_limits (key_hash, window_started_at, attempt_count, updated_at)
       values ($1, now(), 1, now())
       on conflict (key_hash) do update set
         attempt_count = case
           when onboarding_rate_limits.window_started_at < now() - ($2 * interval '1 second') then 1
           else onboarding_rate_limits.attempt_count + 1
         end,
         window_started_at = case
           when onboarding_rate_limits.window_started_at < now() - ($2 * interval '1 second') then now()
           else onboarding_rate_limits.window_started_at
         end,
         updated_at = now()
       returning attempt_count, window_started_at`,
      [hashKey(key), windowSeconds],
    );
    return result.rows[0].attempt_count <= limit;
  });
}

export async function consumeOnboardingRateLimit(request: NextRequest, email: string) {
  const [addressAllowed, emailAllowed] = await Promise.all([
    consume(`ip:${requestAddress(request)}`),
    consume(`email:${email.trim().toLowerCase()}`),
  ]);
  return addressAllowed && emailAllowed;
}
