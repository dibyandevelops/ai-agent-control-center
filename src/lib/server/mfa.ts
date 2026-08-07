import "server-only";
import { appendAuditEvent } from "./audit";
import { markCurrentOperatorSessionMfaVerified, type OperatorIdentity } from "./auth";
import { getPool, withTransaction } from "./db";
import { getServerEnv } from "./env";
import { AuthenticationError, ConflictError } from "./errors";
import { createRecoveryCodes, createTotpSecret, decryptMfaSecret, encryptMfaSecret, hashRecoveryCode, verifyTotp } from "./mfa-core";

function encryptionKey() { const key = getServerEnv().MFA_ENCRYPTION_KEY; if (!key) throw new ConflictError("MFA is unavailable until MFA_ENCRYPTION_KEY is configured."); return key; }

export async function getMfaStatus(operator: OperatorIdentity) {
  const result = await getPool().query<{ enabled_at: Date; last_verified_at: Date | null }>(`select enabled_at, last_verified_at from operator_mfa where operator_id = $1`, [operator.id]);
  const row = result.rows[0]; return { enabled: Boolean(row), enabledAt: row?.enabled_at.toISOString() ?? null, lastVerifiedAt: row?.last_verified_at?.toISOString() ?? null };
}

export function beginMfaEnrollment(operator: OperatorIdentity) {
  const secret = createTotpSecret();
  const label = encodeURIComponent(`SentinelOps:${operator.email}`);
  return { secret, otpauthUrl: `otpauth://totp/${label}?secret=${secret}&issuer=SentinelOps&algorithm=SHA1&digits=6&period=30` };
}

export async function confirmMfaEnrollment(operator: OperatorIdentity, secret: string, code: string) {
  if (!verifyTotp(secret, code)) throw new AuthenticationError("The authenticator code is invalid or expired.");
  const encrypted = encryptMfaSecret(secret, encryptionKey()); const recoveryCodes = createRecoveryCodes();
  await withTransaction(async (client) => {
    await client.query(`insert into operator_mfa (operator_id, encrypted_secret, encryption_iv, encryption_tag, recovery_code_hashes, last_verified_at)
      values ($1,$2,$3,$4,$5::text[],now()) on conflict (operator_id) do update set encrypted_secret=excluded.encrypted_secret,encryption_iv=excluded.encryption_iv,encryption_tag=excluded.encryption_tag,recovery_code_hashes=excluded.recovery_code_hashes,enabled_at=now(),last_verified_at=now(),updated_at=now()`, [operator.id, encrypted.ciphertext, encrypted.iv, encrypted.tag, recoveryCodes.map(hashRecoveryCode)]);
    await appendAuditEvent(client, { organizationId: operator.organizationId, requestId: null, eventType: "operator.mfa_enrolled", actorType: "human", actorId: operator.email, payload: { recoveryCodes: recoveryCodes.length } });
  });
  await markCurrentOperatorSessionMfaVerified(); return recoveryCodes;
}

export async function verifyMfa(operator: OperatorIdentity, code: string) {
  const result = await getPool().query<{ encrypted_secret: string; encryption_iv: string; encryption_tag: string; recovery_code_hashes: string[] }>(`select encrypted_secret,encryption_iv,encryption_tag,recovery_code_hashes from operator_mfa where operator_id=$1`, [operator.id]); const row = result.rows[0]; if (!row) throw new ConflictError("Enroll an authenticator before verifying MFA.");
  const recoveryHash = hashRecoveryCode(code); const usesRecovery = row.recovery_code_hashes.includes(recoveryHash); const secret = decryptMfaSecret({ ciphertext: row.encrypted_secret, iv: row.encryption_iv, tag: row.encryption_tag }, encryptionKey());
  if (!usesRecovery && !verifyTotp(secret, code)) throw new AuthenticationError("The MFA code is invalid or expired.");
  await withTransaction(async (client) => { if (usesRecovery) await client.query(`update operator_mfa set recovery_code_hashes=array_remove(recovery_code_hashes,$2),last_verified_at=now(),updated_at=now() where operator_id=$1`, [operator.id, recoveryHash]); else await client.query(`update operator_mfa set last_verified_at=now(),updated_at=now() where operator_id=$1`, [operator.id]); await appendAuditEvent(client, { organizationId: operator.organizationId, requestId: null, eventType: "operator.mfa_verified", actorType: "human", actorId: operator.email, payload: { method: usesRecovery ? "recovery_code" : "totp" } }); });
  await markCurrentOperatorSessionMfaVerified(); return { usedRecoveryCode: usesRecovery };
}

export async function regenerateMfaRecoveryCodes(operator: OperatorIdentity, code: string) {
  await verifyMfa(operator, code);
  const recoveryCodes = createRecoveryCodes();
  await withTransaction(async (client) => {
    await client.query(`update operator_mfa set recovery_code_hashes=$2::text[],updated_at=now() where operator_id=$1`, [operator.id, recoveryCodes.map(hashRecoveryCode)]);
    await appendAuditEvent(client, { organizationId: operator.organizationId, requestId: null, eventType: "operator.mfa_recovery_codes_regenerated", actorType: "human", actorId: operator.email, payload: { recoveryCodes: recoveryCodes.length } });
  });
  return recoveryCodes;
}
