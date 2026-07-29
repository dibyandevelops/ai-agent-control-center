import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  DB_SSL: z.enum(["true", "false", "1", "0"]).optional(),
  DB_SSL_REJECT_UNAUTHORIZED: z.enum(["true", "false"]).optional(),
  SENTINELOPS_ADMIN_TOKEN: z.string().min(32).optional(),
  SLACK_APPROVAL_WEBHOOK_URL: z.string().url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const result = serverEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL || undefined,
    DB_SSL: process.env.DB_SSL || undefined,
    DB_SSL_REJECT_UNAUTHORIZED:
      process.env.DB_SSL_REJECT_UNAUTHORIZED || undefined,
    SENTINELOPS_ADMIN_TOKEN:
      process.env.SENTINELOPS_ADMIN_TOKEN || undefined,
    SLACK_APPROVAL_WEBHOOK_URL:
      process.env.SLACK_APPROVAL_WEBHOOK_URL || undefined,
  });

  if (!result.success) {
    throw new Error(`Invalid server environment: ${result.error.message}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function requireDatabaseUrl() {
  const value = getServerEnv().DATABASE_URL;
  if (!value) {
    throw new Error(
      "DATABASE_URL is not configured. Copy .env.example to .env.local.",
    );
  }
  return value;
}
