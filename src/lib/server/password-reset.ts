import "server-only";

import { appendAuditEvent } from "./audit";
import { getPool, withTransaction } from "./db";
import { ValidationError } from "./errors";
import { hashPassword } from "./password";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
} from "./password-reset-core";
import { sendPasswordResetEmail } from "./password-reset-email";

export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const result = await getPool().query<{
    id: string;
    organization_id: string;
    display_name: string;
    email: string;
    status: string;
  }>(
    `select id, organization_id, display_name, email, status
       from operators
      where email = $1 and status = 'active'
      limit 1`,
    [normalizedEmail],
  );

  const operator = result.rows[0];
  if (!operator) {
    return { requested: true };
  }

  const { token, hash } = createPasswordResetToken();

  await withTransaction(async (client) => {
    await client.query(
      `update operator_password_resets
          set consumed_at = now()
        where operator_id = $1 and consumed_at is null`,
      [operator.id],
    );

    await client.query(
      `insert into operator_password_resets (operator_id, token_hash, expires_at)
       values ($1, $2, now() + interval '1 hour')`,
      [operator.id, hash],
    );

    await appendAuditEvent(client, {
      organizationId: operator.organization_id,
      requestId: null,
      eventType: "operator.password_reset_requested",
      actorType: "human",
      actorId: operator.email,
      payload: { operatorId: operator.id },
    });
  });

  await sendPasswordResetEmail({
    email: operator.email,
    displayName: operator.display_name,
    token,
  });

  return { requested: true };
}

export async function validatePasswordResetToken(token: string) {
  const hash = hashPasswordResetToken(token.trim());
  const result = await getPool().query<{
    id: string;
    operator_id: string;
    expires_at: Date;
    consumed_at: Date | null;
    email: string;
  }>(
    `select resets.id, resets.operator_id, resets.expires_at, resets.consumed_at, op.email
       from operator_password_resets resets
       join operators op on op.id = resets.operator_id
      where resets.token_hash = $1
      limit 1`,
    [hash],
  );

  const row = result.rows[0];
  if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
    throw new ValidationError("Password reset token is invalid or has expired. Please request a new link.");
  }

  return { valid: true, email: row.email };
}

export async function resetPasswordWithToken(input: {
  token: string;
  newPassword: string;
}) {
  if (input.newPassword.length < 12) {
    throw new ValidationError("Password must be at least 12 characters long.");
  }

  const hash = hashPasswordResetToken(input.token.trim());
  const newPasswordHash = await hashPassword(input.newPassword);

  return withTransaction(async (client) => {
    const result = await client.query<{
      id: string;
      operator_id: string;
      expires_at: Date;
      consumed_at: Date | null;
      organization_id: string;
      email: string;
    }>(
      `select resets.id, resets.operator_id, resets.expires_at, resets.consumed_at,
              op.organization_id, op.email
         from operator_password_resets resets
         join operators op on op.id = resets.operator_id
        where resets.token_hash = $1
        for update`,
      [hash],
    );

    const row = result.rows[0];
    if (!row || row.consumed_at || new Date(row.expires_at).getTime() <= Date.now()) {
      throw new ValidationError("Password reset token is invalid or has expired. Please request a new link.");
    }

    await client.query(
      `update operators
          set password_hash = $2,
              password_change_required = false,
              password_changed_at = now(),
              failed_login_count = 0,
              failed_login_window_started_at = null,
              locked_until = null,
              updated_at = now()
        where id = $1`,
      [row.operator_id, newPasswordHash],
    );

    await client.query(
      `update operator_password_resets
          set consumed_at = now()
        where id = $1`,
      [row.id],
    );

    await client.query(
      `update operator_sessions
          set revoked_at = now()
        where operator_id = $1 and revoked_at is null`,
      [row.operator_id],
    );

    await appendAuditEvent(client, {
      organizationId: row.organization_id,
      requestId: null,
      eventType: "operator.password_reset_completed",
      actorType: "human",
      actorId: row.email,
      payload: {
        operatorId: row.operator_id,
        sessionsRevoked: true,
      },
    });

    return { reset: true, email: row.email };
  });
}
