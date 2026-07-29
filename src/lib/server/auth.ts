import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { PoolClient } from "pg";
import { getServerEnv } from "./env";

const sessionCookieName = "sentinelops_admin_session";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function expectedSessionValue(secret: string) {
  return createHmac("sha256", secret)
    .update("sentinelops:dashboard-session:v1")
    .digest("hex");
}

export function verifyAdminToken(candidate: string) {
  const secret = getServerEnv().SENTINELOPS_ADMIN_TOKEN;
  return Boolean(secret && safeEqual(candidate, secret));
}

export async function hasAdminSession(request?: NextRequest) {
  const secret = getServerEnv().SENTINELOPS_ADMIN_TOKEN;
  if (!secret) return false;

  const authorization = request?.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    return safeEqual(authorization.slice("Bearer ".length), secret);
  }

  const cookieStore = await cookies();
  const value = cookieStore.get(sessionCookieName)?.value;
  return Boolean(value && safeEqual(value, expectedSessionValue(secret)));
}

export async function createAdminSession() {
  const secret = getServerEnv().SENTINELOPS_ADMIN_TOKEN;
  if (!secret) throw new Error("SENTINELOPS_ADMIN_TOKEN is not configured.");
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, expectedSessionValue(secret), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 8,
    path: "/",
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(sessionCookieName);
}

export interface ApiKeyIdentity {
  keyId: string;
  organizationId: string;
  organizationName: string;
}

export async function authenticateApiKey(
  request: NextRequest,
  client: PoolClient,
): Promise<ApiKeyIdentity | null> {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : request.headers.get("x-sentinel-api-key");

  if (!token?.startsWith("sop_live_")) return null;
  const keyHash = createHash("sha256").update(token).digest("hex");
  const result = await client.query<{
    key_id: string;
    organization_id: string;
    organization_name: string;
  }>(
    `
      select
        ak.id as key_id,
        ak.organization_id,
        o.name as organization_name
      from api_keys ak
      join organizations o on o.id = ak.organization_id
      where ak.key_hash = $1
        and ak.revoked_at is null
      limit 1
    `,
    [keyHash],
  );
  const row = result.rows[0];
  if (!row) return null;

  await client.query(
    "update api_keys set last_used_at = now() where id = $1",
    [row.key_id],
  );

  return {
    keyId: row.key_id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
  };
}
