import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  DB_SSL: z.enum(["true", "false", "1", "0"]).optional(),
  DB_SSL_REJECT_UNAUTHORIZED: z.enum(["true", "false"]).optional(),
  SENTINELOPS_ADMIN_TOKEN: z.string().min(32).optional(),
  SLACK_APPROVAL_WEBHOOK_URL: z.string().url().optional(),
  SENTINELOPS_CRON_SECRET: z.string().min(32).optional(),
  POLICY_ACTIVATION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  POLICY_ACTIVATION_REMINDER_MINUTES: z.coerce.number().int().min(5).max(1440).default(240),
  GITHUB_TOKEN: z.string().min(1).optional(),
  GITHUB_REPOSITORY: z
    .string()
    .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/)
    .optional(),
  GITHUB_RELEASE_MODE: z.enum(["draft"]).optional(),
  GITHUB_DRY_RUN: z.enum(["true", "false"]).optional(),
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
    SENTINELOPS_CRON_SECRET:
      process.env.SENTINELOPS_CRON_SECRET || undefined,
    POLICY_ACTIVATION_TTL_HOURS:
      process.env.POLICY_ACTIVATION_TTL_HOURS || undefined,
    POLICY_ACTIVATION_REMINDER_MINUTES:
      process.env.POLICY_ACTIVATION_REMINDER_MINUTES || undefined,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN || undefined,
    GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY || undefined,
    GITHUB_RELEASE_MODE: process.env.GITHUB_RELEASE_MODE || undefined,
    GITHUB_DRY_RUN: process.env.GITHUB_DRY_RUN || undefined,
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
