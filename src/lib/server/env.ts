import "server-only";

import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  SENTINELOPS_PUBLIC_URL: z.string().url().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
  DB_SSL: z.enum(["true", "false", "1", "0"]).optional(),
  DB_SSL_REJECT_UNAUTHORIZED: z.enum(["true", "false"]).optional(),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  SENTINELOPS_ADMIN_TOKEN: z.string().min(32).optional(),
  SLACK_CLIENT_ID: z.string().min(8).optional(),
  SLACK_CLIENT_SECRET: z.string().min(20).optional(),
  SLACK_CREDENTIAL_ENCRYPTION_KEY: z.string().min(43).optional(),
  MFA_ENCRYPTION_KEY: z.string().min(43).optional(),
  RESEND_API_KEY: z.string().min(12).optional(),
  SECURITY_DIGEST_FROM: z.string().min(3).optional(),
  SECURITY_DIGEST_TO: z.string().min(3).optional(),
  ONBOARDING_EMAIL_FROM: z.string().min(3).optional(),
  SENTINELOPS_CRON_SECRET: z.string().min(32).optional(),
  ACTION_APPROVAL_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(30),
  POLICY_ACTIVATION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  POLICY_ACTIVATION_REMINDER_MINUTES: z.coerce.number().int().min(5).max(1440).default(240),
  GITHUB_APP_ID: z.string().regex(/^\d+$/).optional(),
  GITHUB_APP_SLUG: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  GITHUB_APP_CLIENT_ID: z.string().min(10).optional(),
  GITHUB_APP_CLIENT_SECRET: z.string().min(20).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(100).optional(),
  GITHUB_WEBHOOK_SECRET: z.string().min(32).optional(),
  RELEASE_EXECUTION_MODE: z
    .enum(["disabled", "dry_run", "github_draft"])
    .default("dry_run"),
  RELEASE_EXECUTION_BATCH_SIZE: z.coerce.number().int().min(1).max(25).default(10),
  RELEASE_EXECUTION_LEASE_MINUTES: z.coerce.number().int().min(1).max(60).default(10),
  SELF_SERVICE_SIGNUP_ENABLED: z.enum(["true", "false"]).default("false"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | undefined;

function sanitizeOptionalEnvironment(input: Record<string, string | undefined>) {
  const values: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(input).map(([key, value]) => {
      const normalized = value?.trim();
      return [key, normalized && normalized !== "undefined" && normalized !== "null" ? normalized : undefined];
    }),
  );
  const clearIf = (keys: string[], valid: (value: string) => boolean) => {
    for (const key of keys) if (values[key] && !valid(values[key]!)) values[key] = undefined;
  };
  clearIf(["DATABASE_URL", "SENTINELOPS_PUBLIC_URL"], (value) => /^https?:\/\//.test(value) || value.startsWith("postgres"));
  clearIf(["SENTINELOPS_ADMIN_TOKEN", "SENTINELOPS_CRON_SECRET", "GITHUB_WEBHOOK_SECRET"], (value) => value.length >= 32);
  clearIf(["SLACK_CLIENT_ID"], (value) => value.length >= 8);
  clearIf(["GITHUB_APP_CLIENT_ID"], (value) => value.length >= 10);
  clearIf(["SLACK_CLIENT_SECRET", "GITHUB_APP_CLIENT_SECRET"], (value) => value.length >= 20);
  clearIf(["SLACK_CREDENTIAL_ENCRYPTION_KEY", "MFA_ENCRYPTION_KEY"], (value) => value.length >= 43);
  clearIf(["RESEND_API_KEY"], (value) => value.length >= 12);
  clearIf(["SECURITY_DIGEST_FROM", "SECURITY_DIGEST_TO", "ONBOARDING_EMAIL_FROM"], (value) => value.length >= 3);
  clearIf(["GITHUB_APP_PRIVATE_KEY"], (value) => value.length >= 100);
  clearIf(["GITHUB_APP_ID"], (value) => /^\d+$/.test(value));
  clearIf(["GITHUB_APP_SLUG"], (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value));
  clearIf(["ACTION_APPROVAL_TTL_MINUTES", "POLICY_ACTIVATION_TTL_HOURS", "POLICY_ACTIVATION_REMINDER_MINUTES", "RELEASE_EXECUTION_BATCH_SIZE", "RELEASE_EXECUTION_LEASE_MINUTES"], (value) => /^\d+$/.test(value));
  clearIf(["RELEASE_EXECUTION_MODE"], (value) => ["disabled", "dry_run", "github_draft"].includes(value));
  clearIf(["SELF_SERVICE_SIGNUP_ENABLED"], (value) => ["true", "false"].includes(value));
  clearIf(["DB_SSL"], (value) => ["true", "false", "1", "0"].includes(value));
  clearIf(["DB_SSL_REJECT_UNAUTHORIZED"], (value) => ["true", "false"].includes(value));
  return values;
}

export function getServerEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv;

  const result = serverEnvSchema.safeParse(sanitizeOptionalEnvironment({
    DATABASE_URL: process.env.DATABASE_URL || undefined,
    SENTINELOPS_PUBLIC_URL: process.env.SENTINELOPS_PUBLIC_URL || undefined,
    VERCEL_PROJECT_PRODUCTION_URL:
      process.env.VERCEL_PROJECT_PRODUCTION_URL || undefined,
    DB_SSL: process.env.DB_SSL || undefined,
    DB_SSL_REJECT_UNAUTHORIZED:
      process.env.DB_SSL_REJECT_UNAUTHORIZED || undefined,
    DB_POOL_MAX: process.env.DB_POOL_MAX || undefined,
    SENTINELOPS_ADMIN_TOKEN:
      process.env.SENTINELOPS_ADMIN_TOKEN || undefined,
    SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID || undefined,
    SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET || undefined,
    SLACK_CREDENTIAL_ENCRYPTION_KEY:
      process.env.SLACK_CREDENTIAL_ENCRYPTION_KEY || undefined,
    MFA_ENCRYPTION_KEY: process.env.MFA_ENCRYPTION_KEY || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    SECURITY_DIGEST_FROM: process.env.SECURITY_DIGEST_FROM || undefined,
    SECURITY_DIGEST_TO: process.env.SECURITY_DIGEST_TO || undefined,
    ONBOARDING_EMAIL_FROM: process.env.ONBOARDING_EMAIL_FROM || undefined,
    SENTINELOPS_CRON_SECRET:
      process.env.CRON_SECRET ||
      process.env.SENTINELOPS_CRON_SECRET ||
      undefined,
    ACTION_APPROVAL_TTL_MINUTES:
      process.env.ACTION_APPROVAL_TTL_MINUTES || undefined,
    POLICY_ACTIVATION_TTL_HOURS:
      process.env.POLICY_ACTIVATION_TTL_HOURS || undefined,
    POLICY_ACTIVATION_REMINDER_MINUTES:
      process.env.POLICY_ACTIVATION_REMINDER_MINUTES || undefined,
    GITHUB_APP_ID: process.env.GITHUB_APP_ID || undefined,
    GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG || undefined,
    GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID || undefined,
    GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET || undefined,
    GITHUB_APP_PRIVATE_KEY:
      process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n") || undefined,
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET || undefined,
    RELEASE_EXECUTION_MODE:
      process.env.RELEASE_EXECUTION_MODE || undefined,
    RELEASE_EXECUTION_BATCH_SIZE:
      process.env.RELEASE_EXECUTION_BATCH_SIZE || undefined,
    RELEASE_EXECUTION_LEASE_MINUTES:
      process.env.RELEASE_EXECUTION_LEASE_MINUTES || undefined,
    SELF_SERVICE_SIGNUP_ENABLED:
      process.env.SELF_SERVICE_SIGNUP_ENABLED || undefined,
  }));

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

export function getSentinelOpsPublicUrl() {
  const env = getServerEnv();
  if (env.SENTINELOPS_PUBLIC_URL) return env.SENTINELOPS_PUBLIC_URL.replace(/\/$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}
