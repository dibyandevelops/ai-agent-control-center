import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { appendAuditEvent } from "@/lib/server/audit";
import { withTransaction } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";
import { hasValidInternalBearer } from "@/lib/server/internal-auth";
import {
  actionApprovalNotificationSchema,
  githubAppLifecycleAlertSchema,
  githubDriftNotificationSchema,
  policyActivationNotificationSchema,
  releaseExecutionFailureNotificationSchema,
  releaseGovernanceNotificationSchema,
} from "@/lib/server/notification-outbox";
import {
  notificationFailureStatus,
  retryDelaySeconds,
} from "@/lib/server/notification-outbox-core";
import {
  notifySlackOfApproval,
  notifySlackOfGitHubAppLifecycle,
  notifySlackOfGitHubDrift,
  notifySlackOfPolicyActivation,
  notifySlackOfReleaseExecutionFailure,
  notifySlackOfReleaseGovernance,
} from "@/lib/server/slack";
import { runApprovedReleaseWorker } from "@/lib/server/release-execution-worker";
import { runApprovedDraftGovernanceWorker } from "@/lib/server/release-governance-worker";

export const maxDuration = 60;

interface OutboxRow {
  id: string;
  organization_id: string;
  channel: "slack";
  event_type: string;
  payload: unknown;
  attempt_count: number;
  max_attempts: number;
}

interface DeliveryResult {
  row: OutboxRow;
  delivered: boolean;
  reason: string;
}

async function deliver(row: OutboxRow): Promise<DeliveryResult> {
  try {
    if (row.event_type === "action.approval_requested") {
      const parsed = actionApprovalNotificationSchema.safeParse(row.payload);
      if (!parsed.success) {
        return { row, delivered: false, reason: "invalid_payload" };
      }
      const result = await notifySlackOfApproval({
        organizationId: row.organization_id,
        ...parsed.data,
      });
      return { row, delivered: result.delivered, reason: result.reason };
    }
    if (row.event_type === "action.execution_failed") {
      const parsed = releaseExecutionFailureNotificationSchema.safeParse(row.payload);
      if (!parsed.success) {
        return { row, delivered: false, reason: "invalid_payload" };
      }
      const result = await notifySlackOfReleaseExecutionFailure({
        organizationId: row.organization_id,
        ...parsed.data,
      });
      return { row, delivered: result.delivered, reason: result.reason };
    }
    if (row.event_type === "release.draft_governance_requested") {
      const parsed = releaseGovernanceNotificationSchema.safeParse(row.payload);
      if (!parsed.success) {
        return { row, delivered: false, reason: "invalid_payload" };
      }
      const result = await notifySlackOfReleaseGovernance({
        organizationId: row.organization_id,
        ...parsed.data,
      });
      return { row, delivered: result.delivered, reason: result.reason };
    }
    if (row.event_type === "github.release_drift_detected") {
      const parsed = githubDriftNotificationSchema.safeParse(row.payload);
      if (!parsed.success) {
        return { row, delivered: false, reason: "invalid_payload" };
      }
      const result = await notifySlackOfGitHubDrift({
        organizationId: row.organization_id,
        ...parsed.data,
      });
      return { row, delivered: result.delivered, reason: result.reason };
    }
    if (row.event_type === "github.app_lifecycle_alert") {
      const parsed = githubAppLifecycleAlertSchema.safeParse(row.payload);
      if (!parsed.success) {
        return { row, delivered: false, reason: "invalid_payload" };
      }
      const result = await notifySlackOfGitHubAppLifecycle({
        organizationId: row.organization_id,
        ...parsed.data,
      });
      return { row, delivered: result.delivered, reason: result.reason };
    }
    if (!row.event_type.startsWith("policy.activation_")) {
      return { row, delivered: false, reason: "unsupported_event_type" };
    }
    const parsed = policyActivationNotificationSchema.safeParse(row.payload);
    if (!parsed.success) {
      return { row, delivered: false, reason: "invalid_payload" };
    }
    const result = await notifySlackOfPolicyActivation({
      organizationId: row.organization_id,
      ...parsed.data,
    });
    return { row, delivered: result.delivered, reason: result.reason };
  } catch (error) {
    return {
      row,
      delivered: false,
      reason: error instanceof Error ? error.message : "delivery_failed",
    };
  }
}

async function runNotificationOutbox(request: NextRequest) {
  try {
    const env = getServerEnv();
    if (!env.SENTINELOPS_CRON_SECRET) {
      return NextResponse.json(
        { error: "Notification worker is not configured." },
        { status: 503 },
      );
    }
    if (!hasValidInternalBearer(request, env.SENTINELOPS_CRON_SECRET)) {
      return NextResponse.json(
        { error: "Invalid dispatcher credential." },
        { status: 401 },
      );
    }

    const [releaseExecutions, releaseGovernanceExecutions] = await Promise.all([
      runApprovedReleaseWorker(),
      runApprovedDraftGovernanceWorker(),
    ]);

    const workerId = randomUUID();
    const claimed = await withTransaction(async (client) => {
      const result = await client.query<OutboxRow>(
        `
          with candidates as (
            select id
            from notification_outbox
            where (status = 'pending' and available_at <= now())
               or (status = 'processing' and locked_at <= now() - interval '10 minutes')
            order by available_at asc, created_at asc
            for update skip locked
            limit 50
          )
          update notification_outbox outbox
          set status = 'processing',
              attempt_count = attempt_count + 1,
              locked_at = now(),
              locked_by = $1,
              updated_at = now()
          from candidates
          where outbox.id = candidates.id
          returning outbox.id, outbox.organization_id, outbox.channel,
                    outbox.event_type, outbox.payload, outbox.attempt_count,
                    outbox.max_attempts
        `,
        [workerId],
      );
      return result.rows;
    });

    const deliveries: DeliveryResult[] = [];
    for (let index = 0; index < claimed.length; index += 10) {
      deliveries.push(
        ...(await Promise.all(claimed.slice(index, index + 10).map(deliver))),
      );
    }

    const outcomes = await withTransaction(async (client) => {
      let delivered = 0;
      let retried = 0;
      let dead = 0;
      for (const result of deliveries) {
        const nextStatus = result.delivered
          ? "delivered" as const
          : notificationFailureStatus(
              result.row.attempt_count,
              result.row.max_attempts,
            );
        const delaySeconds = result.delivered
          ? 0
          : retryDelaySeconds(result.row.attempt_count);
        const updateResult = await client.query<{ id: string }>(
          `
            update notification_outbox
            set status = $3,
                available_at = case
                  when $3 = 'pending' then now() + ($4 * interval '1 second')
                  else available_at
                end,
                locked_at = null,
                locked_by = null,
                last_error = case when $3 = 'delivered' then null else left($5, 2000) end,
                delivered_at = case when $3 = 'delivered' then now() else delivered_at end,
                updated_at = now()
            where id = $1 and locked_by = $2 and status = 'processing'
            returning id
          `,
          [result.row.id, workerId, nextStatus, delaySeconds, result.reason],
        );
        if (!updateResult.rows[0]) continue;
        if (nextStatus === "delivered") delivered += 1;
        else if (nextStatus === "dead") dead += 1;
        else retried += 1;

        await appendAuditEvent(client, {
          organizationId: result.row.organization_id,
          requestId: null,
          eventType:
            nextStatus === "delivered"
              ? "notification.outbox_delivered"
              : nextStatus === "dead"
                ? "notification.outbox_dead_lettered"
                : "notification.outbox_retry_scheduled",
          actorType: "system",
          actorId: "notification-outbox-worker",
          payload: {
            notificationId: result.row.id,
            channel: result.row.channel,
            notificationEvent: result.row.event_type,
            attemptCount: result.row.attempt_count,
            maxAttempts: result.row.max_attempts,
            deliveryReason: result.reason,
            retryDelaySeconds: nextStatus === "pending" ? delaySeconds : null,
          },
        });
      }
      return { delivered, retried, dead };
    });

    return NextResponse.json({
      claimed: claimed.length,
      ...outcomes,
      releaseExecutions,
      releaseGovernanceExecutions,
    });
  } catch (error) {
    return apiError(error);
  }
}

export const GET = runNotificationOutbox;
export const POST = runNotificationOutbox;
