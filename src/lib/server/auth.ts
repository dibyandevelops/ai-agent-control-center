import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { PoolClient } from "pg";
import { hashAgentApiKey } from "./agent-api-key";
import { appendAuditEvent } from "./audit";
import { getPool, withTransaction } from "./db";
import { hashPassword, verifyPassword } from "./password";
import type { OperatorRole } from "./operator-roles";
import { emailMatchesAllowedDomains } from "./identity-core";

const sessionCookieName = "sentinelops_operator_session";
const defaultSessionDurationMinutes = 8 * 60;
const defaultSessionIdleTimeoutMinutes = 60;
const failedLoginLimit = 5;
const failedLoginWindowSeconds = 15 * 60;
const accountLockSeconds = 15 * 60;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createSessionExpiry(
  client: PoolClient,
  organizationId: string,
) {
  const result = await client.query<{ session_max_duration_minutes: number }>(
    `select session_max_duration_minutes
       from organization_identity_settings
      where organization_id = $1`,
    [organizationId],
  );
  const minutes = result.rows[0]?.session_max_duration_minutes ?? defaultSessionDurationMinutes;
  return new Date(Date.now() + minutes * 60 * 1_000);
}

async function recordSessionEnd(input: {
  sessionId: string;
  organizationId: string;
  email: string;
  reason: "idle_timeout" | "maximum_duration";
}) {
  await withTransaction(async (client) => {
    const revoked = await client.query<{ id: string }>(
      `update operator_sessions set revoked_at = now()
        where id = $1 and revoked_at is null
        returning id`,
      [input.sessionId],
    );
    if (!revoked.rows[0]) return;
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "operator.session_ended",
      actorType: "system",
      actorId: input.email,
      payload: { reason: input.reason },
    });
  });
}

async function recordFailedLogin(operator: {
  id: string;
  organizationId: string;
  email: string;
}) {
  await withTransaction(async (client) => {
    const result = await client.query<{
      failed_login_count: number;
      locked_until: Date | null;
    }>(
      `
        update operators
        set failed_login_count = case
              when failed_login_window_started_at is null
                or failed_login_window_started_at < now() - ($2 * interval '1 second')
                then 1
              else failed_login_count + 1
            end,
            failed_login_window_started_at = case
              when failed_login_window_started_at is null
                or failed_login_window_started_at < now() - ($2 * interval '1 second')
                then now()
              else failed_login_window_started_at
            end,
            locked_until = case
              when case
                when failed_login_window_started_at is null
                  or failed_login_window_started_at < now() - ($2 * interval '1 second')
                  then 1
                else failed_login_count + 1
              end >= $3
                then now() + ($4 * interval '1 second')
              else null
            end,
            updated_at = now()
        where id = $1
          and status = 'active'
          and (locked_until is null or locked_until <= now())
        returning failed_login_count, locked_until
      `,
      [
        operator.id,
        failedLoginWindowSeconds,
        failedLoginLimit,
        accountLockSeconds,
      ],
    );
    const attempt = result.rows[0];
    if (
      attempt?.failed_login_count === failedLoginLimit &&
      attempt.locked_until
    ) {
      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId: null,
        eventType: "operator.locked",
        actorType: "system",
        actorId: operator.email,
        payload: {
          failedAttempts: failedLoginLimit,
          lockDurationMinutes: accountLockSeconds / 60,
          lockedUntil: attempt.locked_until.toISOString(),
        },
      });
    }
  });
}

export interface OperatorIdentity {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  displayName: string;
  role: OperatorRole;
  mustChangePassword: boolean;
}

export async function getOperatorSession(options?: {
  allowPasswordChangeRequired?: boolean;
}): Promise<OperatorIdentity | null> {
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
    password_change_required: boolean;
    session_id: string;
    session_expires_at: Date;
    session_last_seen_at: Date;
    session_idle_timeout_minutes: number | null;
  }>(
    `
      select
        op.id,
        op.organization_id,
        org.name as organization_name,
        op.email,
        op.display_name,
        op.role,
        op.password_change_required,
        os.id as session_id,
        os.expires_at as session_expires_at,
        os.last_seen_at as session_last_seen_at,
        identity_settings.session_idle_timeout_minutes
      from operator_sessions os
      join operators op on op.id = os.operator_id
      join organizations org on org.id = op.organization_id
      left join organization_identity_settings identity_settings
        on identity_settings.organization_id = op.organization_id
      where os.token_hash = $1
        and os.revoked_at is null
        and op.status = 'active'
      limit 1
    `,
    [hashSessionToken(token)],
  );
  const row = result.rows[0];
  if (!row) return null;
  const now = Date.now();
  const idleTimeoutMinutes =
    row.session_idle_timeout_minutes ?? defaultSessionIdleTimeoutMinutes;
  const endedForMaximumDuration = row.session_expires_at.getTime() <= now;
  const endedForInactivity =
    row.session_last_seen_at.getTime() + idleTimeoutMinutes * 60 * 1_000 <= now;
  if (endedForMaximumDuration || endedForInactivity) {
    await recordSessionEnd({
      sessionId: row.session_id,
      organizationId: row.organization_id,
      email: row.email,
      reason: endedForMaximumDuration ? "maximum_duration" : "idle_timeout",
    });
    return null;
  }
  if (
    row.password_change_required &&
    !options?.allowPasswordChangeRequired
  ) {
    return null;
  }

  void getPool()
    .query(
      `
        update operator_sessions
        set last_seen_at = now()
        where id = $1
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
    mustChangePassword: row.password_change_required,
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
    password_change_required: boolean;
    status: "active" | "disabled";
    locked_until: Date | null;
    allowed_email_domains: string[] | null;
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
        op.password_change_required,
        op.status,
        op.locked_until,
        identity_settings.allowed_email_domains
      from operators op
      join organizations org on org.id = op.organization_id
      left join organization_identity_settings identity_settings
        on identity_settings.organization_id = op.organization_id
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
  if (row.status !== "active") return null;
  if (!emailMatchesAllowedDomains(row.email, row.allowed_email_domains ?? [])) return null;
  if (!valid) {
    if (!row.locked_until || row.locked_until.getTime() <= Date.now()) {
      await recordFailedLogin({
        id: row.id,
        organizationId: row.organization_id,
        email: row.email,
      });
    }
    return null;
  }
  if (row.locked_until && row.locked_until.getTime() > Date.now()) return null;

  const token = `sos_session_${randomBytes(32).toString("base64url")}`;
  const loggedIn = await withTransaction(async (client) => {
    const unlocked = await client.query<{ id: string }>(
      `
        update operators
        set last_login_at = now(),
            failed_login_count = 0,
            failed_login_window_started_at = null,
            locked_until = null,
            updated_at = now()
        where id = $1
          and status = 'active'
          and (locked_until is null or locked_until <= now())
        returning id
      `,
      [row.id],
    );
    if (!unlocked.rows[0]) return false;
    const expiresAt = await createSessionExpiry(client, row.organization_id);
    await client.query(
      `
        insert into operator_sessions (operator_id, token_hash, expires_at)
        values ($1, $2, $3)
      `,
      [row.id, hashSessionToken(token), expiresAt],
    );
    await appendAuditEvent(client, {
      organizationId: row.organization_id,
      requestId: null,
      eventType: "operator.login",
      actorType: "human",
      actorId: row.email,
      payload: { role: row.role },
    });
    return expiresAt;
  });
  if (!loggedIn) return null;

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: loggedIn,
    path: "/",
  });

  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    mustChangePassword: row.password_change_required,
  } satisfies OperatorIdentity;
}

export async function loginOperatorWithSaml(input: {
  organizationId: string;
  email: string;
}) {
  const result = await getPool().query<{
    id: string; organization_id: string; organization_name: string; email: string;
    display_name: string; role: OperatorRole; password_change_required: boolean;
    status: "active" | "disabled";
  }>(
    `select op.id, op.organization_id, org.name as organization_name, op.email,
            op.display_name, op.role, op.password_change_required, op.status
       from operators op join organizations org on org.id = op.organization_id
      where op.organization_id = $1 and op.email = $2
      limit 1`,
    [input.organizationId, input.email.trim().toLowerCase()],
  );
  const row = result.rows[0];
  if (!row || row.status !== "active") return null;
  const token = `sos_session_${randomBytes(32).toString("base64url")}`;
  const expiresAt = await withTransaction(async (client) => {
    const sessionExpiry = await createSessionExpiry(client, row.organization_id);
    await client.query(
      `insert into operator_sessions (operator_id, token_hash, expires_at)
       values ($1, $2, $3)`,
      [row.id, hashSessionToken(token), sessionExpiry],
    );
    await appendAuditEvent(client, {
      organizationId: row.organization_id,
      requestId: null,
      eventType: "operator.saml_login",
      actorType: "human",
      actorId: row.email,
      payload: { role: row.role },
    });
    return sessionExpiry;
  });
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: expiresAt, path: "/" });
  return { id: row.id, organizationId: row.organization_id, organizationName: row.organization_name, email: row.email, displayName: row.display_name, role: row.role, mustChangePassword: row.password_change_required } satisfies OperatorIdentity;
}

export type PasswordChangeResult =
  | { ok: true; operator: OperatorIdentity }
  | { ok: false; reason: "invalid_current" | "same_password" | "conflict" };

export async function changeOperatorPassword(
  operator: OperatorIdentity,
  currentPassword: string,
  newPassword: string,
): Promise<PasswordChangeResult> {
  const result = await getPool().query<{
    password_hash: string;
    status: "active" | "disabled";
  }>(
    `
      select password_hash, status
      from operators
      where id = $1
        and organization_id = $2
      limit 1
    `,
    [operator.id, operator.organizationId],
  );
  const account = result.rows[0];
  if (
    !account ||
    account.status !== "active" ||
    !(await verifyPassword(currentPassword, account.password_hash))
  ) {
    return { ok: false, reason: "invalid_current" };
  }
  if (currentPassword === newPassword) {
    return { ok: false, reason: "same_password" };
  }

  const newPasswordHash = await hashPassword(newPassword);
  const token = `sos_session_${randomBytes(32).toString("base64url")}`;
  const changed = await withTransaction(async (client) => {
    const updateResult = await client.query<{ id: string }>(
      `
        update operators
        set password_hash = $3,
            password_change_required = false,
            password_changed_at = now(),
            updated_at = now()
        where id = $1
          and organization_id = $2
          and password_hash = $4
          and status = 'active'
        returning id
      `,
      [operator.id, operator.organizationId, newPasswordHash, account.password_hash],
    );
    if (!updateResult.rows[0]) return false;
    const expiresAt = await createSessionExpiry(client, operator.organizationId);

    await client.query(
      `
        update operator_sessions
        set revoked_at = now()
        where operator_id = $1
          and revoked_at is null
      `,
      [operator.id],
    );
    await client.query(
      `
        insert into operator_sessions (operator_id, token_hash, expires_at)
        values ($1, $2, $3)
      `,
      [operator.id, hashSessionToken(token), expiresAt],
    );
    await appendAuditEvent(client, {
      organizationId: operator.organizationId,
      requestId: null,
      eventType: "operator.password_changed",
      actorType: "human",
      actorId: operator.email,
      payload: { sessionsRotated: true },
    });
    return expiresAt;
  });
  if (!changed) return { ok: false, reason: "conflict" };

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: changed,
    path: "/",
  });
  return {
    ok: true,
    operator: { ...operator, mustChangePassword: false },
  };
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
  const keyHash = hashAgentApiKey(token);
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
