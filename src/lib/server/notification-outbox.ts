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
