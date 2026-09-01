#!/usr/bin/env node
/**
 * Generate a test API key for SDK development.
 * 
 * Usage:
 *   node scripts/generate-test-api-key.mjs
 * 
 * This creates an API key directly in the database,
 * bypassing the dashboard auth flow. For development only.
 */

import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  console.error("Load your .env.local first: source .env.local");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // Find the first organization
    const orgResult = await client.query(
      "SELECT id, name FROM organizations LIMIT 1"
    );
    if (orgResult.rows.length === 0) {
      console.error("ERROR: No organization found. Create an account first via the dashboard.");
      process.exit(1);
    }
    const org = orgResult.rows[0];

    // Generate the key
    const apiKeyPrefix = "sop_live_";
    const rawKey = `${apiKeyPrefix}${randomBytes(32).toString("base64url")}`;
    const keyHash = createHash("sha256").update(rawKey).digest("hex");
    const visiblePrefix = rawKey.slice(0, 16);
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year

    // Insert
    const result = await client.query(
      `INSERT INTO api_keys (organization_id, name, key_prefix, key_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, key_prefix, created_at`,
      [org.id, "SDK Development Key", visiblePrefix, keyHash, expiresAt]
    );

    const row = result.rows[0];

    console.log();
    console.log("  ✓ API key created for organization:", org.name);
    console.log();
    console.log("  ┌──────────────────────────────────────────────────────┐");
    console.log("  │  COPY THIS KEY — you will not see it again          │");
    console.log("  └──────────────────────────────────────────────────────┘");
    console.log();
    console.log(`  ${rawKey}`);
    console.log();
    console.log("  To use it:");
    console.log(`  export SENTINELOPS_API_KEY="${rawKey}"`);
    console.log();
    console.log("  Key ID:", row.id);
    console.log("  Prefix:", row.key_prefix);
    console.log("  Expires:", expiresAt.toISOString());
    console.log();
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("ERROR:", err.message);
  process.exit(1);
});
