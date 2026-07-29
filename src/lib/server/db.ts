import "server-only";

import { Pool, type PoolClient, type QueryConfig, type QueryResultRow } from "pg";
import { getServerEnv, requireDatabaseUrl } from "./env";

const globalForDatabase = globalThis as typeof globalThis & {
  sentinelopsPool?: Pool;
};

function createPool() {
  const env = getServerEnv();
  return new Pool({
    connectionString: requireDatabaseUrl(),
    max: 10,
    connectionTimeoutMillis: 8_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    statement_timeout: 10_000,
    ssl:
      env.DB_SSL === "true" || env.DB_SSL === "1"
        ? {
            rejectUnauthorized:
              env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
          }
        : undefined,
  });
}

export function getPool() {
  if (!globalForDatabase.sentinelopsPool) {
    globalForDatabase.sentinelopsPool = createPool();
    globalForDatabase.sentinelopsPool.on("error", (error) => {
      console.error("Unexpected PostgreSQL pool error", error);
    });
  }
  return globalForDatabase.sentinelopsPool;
}

export async function query<T extends QueryResultRow>(
  config: QueryConfig,
): Promise<T[]> {
  const result = await getPool().query<T>(config);
  return result.rows;
}

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query("set local statement_timeout = '10s'");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
