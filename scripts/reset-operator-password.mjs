import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import process from "node:process";
import { Pool } from "pg";

const scrypt = promisify(scryptCallback);

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--email=")) {
      options.email = arg.split("=")[1];
    } else if (arg === "--email" && i + 1 < args.length) {
      options.email = args[++i];
    } else if (arg.startsWith("--password=")) {
      options.password = arg.split("=")[1];
    } else if (arg === "--password" && i + 1 < args.length) {
      options.password = args[++i];
    }
  }
  return options;
}

const parsedArgs = parseArgs();
const connectionString = process.env.DATABASE_URL;
const email = (parsedArgs.email || process.env.SENTINELOPS_OPERATOR_EMAIL || "").trim().toLowerCase();
const password = parsedArgs.password || process.env.SENTINELOPS_OPERATOR_PASSWORD || process.env.SENTINELOPS_ADMIN_TOKEN;

if (!connectionString) throw new Error("DATABASE_URL is required.");
if (!email || !email.includes("@")) {
  throw new Error("Specify --email or SENTINELOPS_OPERATOR_EMAIL (must be a valid email).");
}
if (!password || password.length < 12) {
  throw new Error("Specify --password or SENTINELOPS_OPERATOR_PASSWORD (at least 12 characters).");
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
      update operators
      set password_hash = $2,
          password_change_required = false,
          password_changed_at = now(),
          failed_login_count = 0,
          locked_until = null,
          status = 'active',
          updated_at = now()
      where lower(email) = lower($1)
      returning id, email, display_name, role
    `,
    [email, passwordHash],
  );
  const operator = result.rows[0];
  if (!operator) throw new Error(`Operator with email ${email} was not found.`);
  await pool.query("delete from operator_sessions where operator_id = $1", [operator.id]);
  console.log(`Password reset successfully for operator: ${operator.display_name} <${operator.email}> (${operator.role})`);
  console.log("All existing active sessions were revoked.");
} finally {
  await pool.end();
}
