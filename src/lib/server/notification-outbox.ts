import "server-only";

import type { PoolClient } from "pg";
import { z } from "zod";
import { enqueueHttpsWebhookFanout } from "./https-webhooks";
import { scheduleNotificationOutboxDispatch } from "./notification-dispatch";

export type PolicyNotificationKind =
  | "requested"
  | "reminder"
  | "escalation"
  | "expired";

export const policyActivationNotificationSchema = z.object({
  kind: z.enum(["requested", "reminder", "escalation", "expired"]),
  requestId: z.string().uuid(),
  policyId: z.string().uuid(),
  policyName: z.string().min(1).max(160),
  versionId: z.string().uuid(),
  versionNumber: z.number().int().positive(),
  requestedBy: z.string().email(),
  expiresAt: z.string().datetime(),
  reminderCount: z.number().int().nonnegative(),
});

export type PolicyActivationNotificationPayload = z.infer<
  typeof policyActivationNotificationSchema
>;

export const actionApprovalNotificationSchema = z.object({
  requestId: z.string().uuid(),
  agentName: z.string().trim().min(1).max(160),
  action: z.string().trim().min(1).max(200),
  resource: z.string().trim().min(1).max(500),
  risk: z.enum(["low", "medium", "high"]),
});

export type ActionApprovalNotificationPayload = z.infer<
  typeof actionApprovalNotificationSchema
>;

export const releaseExecutionFailureNotificationSchema = z.object({
  requestId: z.string().uuid(),
  agentName: z.string().trim().min(1).max(160),
  action: z.string().trim().min(1).max(200),
  resource: z.string().trim().min(1).max(500),
  error: z.string().trim().min(1).max(1_000),
  attemptCount: z.number().int().positive(),
});

export type ReleaseExecutionFailureNotificationPayload = z.infer<
  typeof releaseExecutionFailureNotificationSchema
>;

export const releaseGovernanceNotificationSchema = z.object({
  governanceId: z.string().uuid(),
  requestId: z.string().uuid(),
  operation: z.enum(["publish", "cancel"]),
  resource: z.string().trim().min(1).max(500),
  requestedBy: z.string().email(),
  expiresAt: z.string().datetime(),
});

export type ReleaseGovernanceNotificationPayload = z.infer<
  typeof releaseGovernanceNotificationSchema
>;

export const githubDriftNotificationSchema = z.object({
  incidentId: z.string().uuid(),
  requestId: z.string().uuid().nullable(),
  repository: z.string().trim().min(3).max(300),
  tagName: z.string().trim().min(1).max(200),
  eventAction: z.string().trim().min(1).max(80),
  severity: z.enum(["high", "critical"]),
  actorLogin: z.string().trim().min(1).max(200),
  reason: z.string().trim().min(1).max(1_000),
  externalReference: z.string().url().nullable(),
});

export type GitHubDriftNotificationPayload = z.infer<
  typeof githubDriftNotificationSchema
>;

export const githubAppLifecycleAlertSchema = z.object({
  deliveryId: z.string().trim().min(1).max(100),
  installationId: z.string().regex(/^\d+$/),
  accountLogin: z.string().trim().min(1).max(200),
  change: z.enum(["suspended", "disconnected", "repository_access_removed"]),
  severity: z.enum(["high", "critical"]),
  actorLogin: z.string().trim().min(1).max(200),
  repositories: z.array(z.string().trim().min(3).max(300)).max(100),
  remediationUrl: z.string().url(),
});

export const securityDigestNotificationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalEvents: z.number().int().nonnegative(),
  mfaEvents: z.number().int().nonnegative(),
  sessionEvents: z.number().int().nonnegative(),
  credentialEvents: z.number().int().nonnegative(),
  identityEvents: z.number().int().nonnegative(),
  auditUrl: z.string().url(),
  highlights: z.array(z.object({ label: z.string().min(1).max(240), auditUrl: z.string().url() })).max(5),
});

export type SecurityDigestNotificationPayload = z.infer<typeof securityDigestNotificationSchema>;

export async function enqueueSecurityDigestNotification(client: PoolClient, input: { organizationId: string; payload: SecurityDigestNotificationPayload }) {
  const payload = securityDigestNotificationSchema.parse(input.payload);
  const result = await client.query<{ id: string }>(
    `insert into notification_outbox (organization_id, channel, event_type, dedupe_key, payload)
     values ($1, 'slack', 'security.daily_digest', $2, $3::jsonb)
     on conflict (channel, dedupe_key) do nothing returning id`,
    [input.organizationId, `security-digest:${input.organizationId}:${payload.date}`, JSON.stringify(payload)],
  );
  return finalizeNotificationEnqueue(client, result, {
    organizationId: input.organizationId,
    channel: "slack",
    eventType: "security.daily_digest",
    dedupeKey: `security-digest:${input.organizationId}:${payload.date}`,
    payload,
  });
}

export async function enqueueSecurityDigestEmail(client: PoolClient, input: { organizationId: string; payload: SecurityDigestNotificationPayload }) {
  const payload = securityDigestNotificationSchema.parse(input.payload);
  const result = await client.query<{ id: string }>(`insert into notification_outbox (organization_id, channel, event_type, dedupe_key, payload)
    values ($1, 'email', 'security.daily_digest', $2, $3::jsonb) on conflict (channel, dedupe_key) do nothing returning id`, [input.organizationId, `security-digest-email:${input.organizationId}:${payload.date}`, JSON.stringify(payload)]);
  return finalizeNotificationEnqueue(client, result, {
    organizationId: input.organizationId,
    channel: "email",
    eventType: "security.daily_digest",
    dedupeKey: `security-digest-email:${input.organizationId}:${payload.date}`,
    payload,
  });
}

export type GitHubAppLifecycleAlertPayload = z.infer<
  typeof githubAppLifecycleAlertSchema
>;

async function finalizeNotificationEnqueue(
  client: PoolClient,
  result: { rows: { id: string }[] },
  input: {
    organizationId: string;
    channel: string;
    eventType: string;
    dedupeKey: string;
    payload: unknown;
  },
) {
  const httpsInserted =
    input.channel === "slack"
      ? await enqueueHttpsWebhookFanout(client, {
          organizationId: input.organizationId,
          eventType: input.eventType,
          dedupeKey: input.dedupeKey,
          payload: input.payload,
        })
      : false;
  const id = result.rows[0]?.id ?? null;
  if (id || httpsInserted) scheduleNotificationOutboxDispatch();
  return { enqueued: Boolean(id) || httpsInserted, id };
}

export async function enqueueGitHubAppLifecycleAlert(
  client: PoolClient,
  input: {
    organizationId: string;
    payload: GitHubAppLifecycleAlertPayload;
  },
) {
  const payload = githubAppLifecycleAlertSchema.parse(input.payload);
  const result = await client.query<{ id: string }>(
    `
      insert into notification_outbox (
        organization_id, channel, event_type, dedupe_key, payload
      )
      values ($1, 'slack', 'github.app_lifecycle_alert', $2, $3::jsonb)
      on conflict (channel, dedupe_key) do nothing
      returning id
    `,
    [
      input.organizationId,
      `github-app-lifecycle:${payload.deliveryId}`,
      JSON.stringify(payload),
    ],
  );
  return finalizeNotificationEnqueue(client, result, {
    organizationId: input.organizationId,
    channel: "slack",
    eventType: "github.app_lifecycle_alert",
    dedupeKey: `github-app-lifecycle:${payload.deliveryId}`,
    payload,
  });
}

export async function enqueueGitHubDriftNotification(
  client: PoolClient,
  input: {
    organizationId: string;
    payload: GitHubDriftNotificationPayload;
  },
) {
  const result = await client.query<{ id: string }>(
    `
      insert into notification_outbox (
        organization_id, channel, event_type, dedupe_key, payload
      )
      values ($1, 'slack', 'github.release_drift_detected', $2, $3::jsonb)
      on conflict (channel, dedupe_key) do nothing
      returning id
    `,
    [
      input.organizationId,
      `github-drift:${input.payload.incidentId}`,
      JSON.stringify(input.payload),
    ],
  );
  return finalizeNotificationEnqueue(client, result, {
    organizationId: input.organizationId,
    channel: "slack",
    eventType: "github.release_drift_detected",
    dedupeKey: `github-drift:${input.payload.incidentId}`,
    payload: input.payload,
  });
}

export async function enqueueReleaseGovernanceNotification(
  client: PoolClient,
  input: {
    organizationId: string;
    payload: ReleaseGovernanceNotificationPayload;
  },
) {
  const result = await client.query<{ id: string }>(
    `
      insert into notification_outbox (
        organization_id, channel, event_type, dedupe_key, payload
      )
      values ($1, 'slack', 'release.draft_governance_requested', $2, $3::jsonb)
      on conflict (channel, dedupe_key) do nothing
      returning id
    `,
    [
      input.organizationId,
      `release-governance:${input.payload.governanceId}:requested`,
      JSON.stringify(input.payload),
    ],
  );
  return finalizeNotificationEnqueue(client, result, {
    organizationId: input.organizationId,
    channel: "slack",
    eventType: "release.draft_governance_requested",
    dedupeKey: `release-governance:${input.payload.governanceId}:requested`,
    payload: input.payload,
  });
}

export async function enqueueReleaseExecutionFailureNotification(
  client: PoolClient,
  input: {
    organizationId: string;
    payload: ReleaseExecutionFailureNotificationPayload;
  },
) {
  const result = await client.query<{ id: string }>(
    `
      insert into notification_outbox (
        organization_id,
        channel,
        event_type,
        dedupe_key,
        payload
      )
      values ($1, 'slack', 'action.execution_failed', $2, $3::jsonb)
      on conflict (channel, dedupe_key) do nothing
      returning id
    `,
    [
      input.organizationId,
      `release-execution:${input.payload.requestId}:failed:${input.payload.attemptCount}`,
      JSON.stringify(input.payload),
    ],
  );
  return finalizeNotificationEnqueue(client, result, {
    organizationId: input.organizationId,
    channel: "slack",
    eventType: "action.execution_failed",
    dedupeKey: `release-execution:${input.payload.requestId}:failed:${input.payload.attemptCount}`,
    payload: input.payload,
  });
}

export async function enqueueActionApprovalNotification(
  client: PoolClient,
  input: {
    organizationId: string;
    payload: ActionApprovalNotificationPayload;
  },
) {
  const result = await client.query<{ id: string }>(
    `
      insert into notification_outbox (
        organization_id,
        channel,
        event_type,
        dedupe_key,
        payload
      )
      values ($1, 'slack', 'action.approval_requested', $2, $3::jsonb)
      on conflict (channel, dedupe_key) do nothing
      returning id
    `,
    [
      input.organizationId,
      `action-approval:${input.payload.requestId}:requested`,
      JSON.stringify(input.payload),
    ],
  );
  return finalizeNotificationEnqueue(client, result, {
    organizationId: input.organizationId,
    channel: "slack",
    eventType: "action.approval_requested",
    dedupeKey: `action-approval:${input.payload.requestId}:requested`,
    payload: input.payload,
  });
}

export async function enqueuePolicyActivationNotification(
  client: PoolClient,
  input: {
    organizationId: string;
    sequence: number;
    payload: PolicyActivationNotificationPayload;
  },
) {
  const result = await client.query<{ id: string }>(
    `
      insert into notification_outbox (
        organization_id,
        channel,
        event_type,
        dedupe_key,
        payload
      )
      values ($1, 'slack', $2, $3, $4::jsonb)
      on conflict (channel, dedupe_key) do nothing
      returning id
    `,
    [
      input.organizationId,
      `policy.activation_${input.payload.kind}`,
      [
        "policy-activation",
        input.payload.requestId,
        input.payload.kind,
        input.sequence,
      ].join(":"),
      JSON.stringify(input.payload),
    ],
  );
  return finalizeNotificationEnqueue(client, result, {
    organizationId: input.organizationId,
    channel: "slack",
    eventType: `policy.activation_${input.payload.kind}`,
    dedupeKey: [
      "policy-activation",
      input.payload.requestId,
      input.payload.kind,
      input.sequence,
    ].join(":"),
    payload: input.payload,
  });
}
