import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import process from "node:process";
import { Pool } from "pg";

const scrypt = promisify(scryptCallback);
const connectionString = process.env.DATABASE_URL;
const email = (process.env.SENTINELOPS_OPERATOR_EMAIL || "").trim().toLowerCase();
const displayName = (process.env.SENTINELOPS_OPERATOR_NAME || "").trim();
const role = process.env.SENTINELOPS_OPERATOR_ROLE || "admin";
const password =
  process.env.SENTINELOPS_OPERATOR_PASSWORD ||
  process.env.SENTINELOPS_ADMIN_TOKEN;
const organizationSlug =
  process.env.SENTINELOPS_OPERATOR_ORGANIZATION || "aperture-labs";

if (!connectionString) throw new Error("DATABASE_URL is required.");
if (!email || !email.includes("@")) {
  throw new Error("SENTINELOPS_OPERATOR_EMAIL must be a valid email.");
}
if (displayName.length < 2) {
  throw new Error("SENTINELOPS_OPERATOR_NAME must contain at least 2 characters.");
}
if (!["admin", "approver", "auditor"].includes(role)) {
  throw new Error("SENTINELOPS_OPERATOR_ROLE must be admin, approver, or auditor.");
}
if (!password || password.length < 12) {
  throw new Error(
    "Set SENTINELOPS_OPERATOR_PASSWORD to at least 12 characters.",
  );
}

async function hashPassword(value) {
  const salt = randomBytes(16);
  const derived = await scrypt(value, salt, 64, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return [
    "scrypt",
    16_384,
    8,
    1,
    salt.toString("base64url"),
    Buffer.from(derived).toString("base64url"),
  ].join("$");
}

const pool = new Pool({
  connectionString,
  max: 2,
  ssl:
    process.env.DB_SSL === "true" || process.env.DB_SSL === "1"
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
      : undefined,
});

try {
  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `
      insert into operators (
        organization_id, email, display_name, role, password_hash
      )
      select id, $2, $3, $4, $5
      from organizations
      where slug = $1
      on conflict (organization_id, email) do update
      set display_name = excluded.display_name,
          role = excluded.role,
          password_hash = excluded.password_hash,
          status = 'active',
          updated_at = now()
      returning id, email, display_name, role
    `,
    [organizationSlug, email, displayName, role, passwordHash],
  );
  const operator = result.rows[0];
  if (!operator) throw new Error(`Organization ${organizationSlug} was not found.`);
  console.log(`Operator ready: ${operator.display_name} <${operator.email}> (${operator.role})`);
  console.log("Password was hashed with scrypt and was not printed.");
} finally {
  await pool.end();
}
