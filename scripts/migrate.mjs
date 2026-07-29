import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const pool = new Pool({
  connectionString,
  max: 2,
  ssl:
    process.env.DB_SSL === "true" || process.env.DB_SSL === "1"
      ? {
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
        }
      : undefined,
});

async function migrate() {
  await pool.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `);

  const migrationsDirectory = path.join(
    process.cwd(),
    "database",
    "migrations",
  );
  const filenames = (await fs.readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith(".sql"))
    .sort();

  const appliedResult = await pool.query(
    "select filename from schema_migrations",
  );
  const applied = new Set(appliedResult.rows.map((row) => row.filename));

  for (const filename of filenames) {
    if (applied.has(filename)) continue;
    const sql = await fs.readFile(
      path.join(migrationsDirectory, filename),
      "utf8",
    );
    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query("set local statement_timeout = '30s'");
      await client.query(sql);
      await client.query(
        "insert into schema_migrations (filename) values ($1)",
        [filename],
      );
      await client.query("commit");
      console.log(`Applied ${filename}`);
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

try {
  await migrate();
  console.log("Database migrations are up to date.");
} finally {
  await pool.end();
}
