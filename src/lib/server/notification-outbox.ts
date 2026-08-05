import "server-only";

import type { PoolClient } from "pg";
import { z } from "zod";

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
  return { enqueued: Boolean(result.rows[0]), id: result.rows[0]?.id ?? null };
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
  return { enqueued: Boolean(result.rows[0]), id: result.rows[0]?.id ?? null };
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
  return { enqueued: Boolean(result.rows[0]), id: result.rows[0]?.id ?? null };
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
  return { enqueued: Boolean(result.rows[0]), id: result.rows[0]?.id ?? null };
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
  return { enqueued: Boolean(result.rows[0]), id: result.rows[0]?.id ?? null };
}
