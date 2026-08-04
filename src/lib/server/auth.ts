import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { PoolClient } from "pg";
import { appendAuditEvent } from "./audit";
import { getPool, withTransaction } from "./db";
import { hashPassword, verifyPassword } from "./password";
import type { OperatorRole } from "./operator-roles";

const sessionCookieName = "sentinelops_operator_session";
const sessionDurationMs = 8 * 60 * 60 * 1_000;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export interface OperatorIdentity {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  displayName: string;
  role: OperatorRole;
}

export async function getOperatorSession(): Promise<OperatorIdentity | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token?.startsWith("sos_session_")) return null;

  const result = await getPool().query<{
    id: string;
    organization_id: string;
    organization_name: string;
    email: string;
    display_name: string;
    role: OperatorRole;
    session_id: string;
  }>(
    `
      select
        op.id,
        op.organization_id,
        org.name as organization_name,
        op.email,
        op.display_name,
        op.role,
        os.id as session_id
      from operator_sessions os
      join operators op on op.id = os.operator_id
      join organizations org on org.id = op.organization_id
      where os.token_hash = $1
        and os.revoked_at is null
        and os.expires_at > now()
        and op.status = 'active'
      limit 1
    `,
    [hashSessionToken(token)],
  );
  const row = result.rows[0];
  if (!row) return null;

  void getPool()
    .query(
      `
        update operator_sessions
        set last_seen_at = now()
        where id = $1
          and last_seen_at < now() - interval '5 minutes'
      `,
      [row.session_id],
    )
    .catch(() => undefined);

  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
  };
}

export async function loginOperator(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await getPool().query<{
    id: string;
    organization_id: string;
    organization_name: string;
    email: string;
    display_name: string;
    role: OperatorRole;
    password_hash: string;
    status: "active" | "disabled";
  }>(
    `
      select
        op.id,
        op.organization_id,
        org.name as organization_name,
        op.email,
        op.display_name,
        op.role,
        op.password_hash,
        op.status
      from operators op
      join organizations org on org.id = op.organization_id
      where op.email = $1
      limit 1
    `,
    [normalizedEmail],
  );
  const row = result.rows[0];
  if (!row) {
    await hashPassword(password);
    return null;
  }
  const valid = await verifyPassword(password, row.password_hash);
  if (!valid || row.status !== "active") return null;

  const token = `sos_session_${randomBytes(32).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + sessionDurationMs);
  await withTransaction(async (client) => {
    await client.query(
      `
        insert into operator_sessions (operator_id, token_hash, expires_at)
        values ($1, $2, $3)
      `,
      [row.id, hashSessionToken(token), expiresAt],
    );
    await client.query(
      "update operators set last_login_at = now(), updated_at = now() where id = $1",
      [row.id],
    );
    await appendAuditEvent(client, {
      organizationId: row.organization_id,
      requestId: null,
      eventType: "operator.login",
      actorType: "human",
      actorId: row.email,
      payload: { role: row.role },
    });
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });

  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
  } satisfies OperatorIdentity;
}

export async function clearOperatorSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (token) {
    await getPool().query(
      "update operator_sessions set revoked_at = now() where token_hash = $1",
      [hashSessionToken(token)],
    );
  }
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
