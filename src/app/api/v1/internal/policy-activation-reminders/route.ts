import { NextRequest, NextResponse } from "next/server";
import { appendAuditEvent } from "@/lib/server/audit";
import { withTransaction } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";
import { hasValidInternalBearer } from "@/lib/server/internal-auth";
import { enqueuePolicyActivationNotification } from "@/lib/server/notification-outbox";

type NotificationKind = "reminder" | "escalation" | "expired";

interface PolicyNotification {
  kind: NotificationKind;
  requestId: string;
  organizationId: string;
  policyId: string;
  policyName: string;
  versionId: string;
  versionNumber: number;
  requestedBy: string;
  expiresAt: Date;
  reminderCount: number;
}

async function dispatchPolicyActivationReminders(request: NextRequest) {
  try {
    const env = getServerEnv();
    if (!env.SENTINELOPS_CRON_SECRET) {
      return NextResponse.json(
        { error: "Policy reminder dispatcher is not configured." },
        { status: 503 },
      );
    }
    if (!hasValidInternalBearer(request, env.SENTINELOPS_CRON_SECRET)) {
      return NextResponse.json({ error: "Invalid dispatcher credential." }, { status: 401 });
    }

    const notifications = await withTransaction(async (client) => {
      const expiredResult = await client.query<{
        id: string;
        organization_id: string;
        policy_id: string;
        version_id: string;
        policy_name: string;
        version_number: number;
        requested_by_email: string;
        expires_at: Date;
        reminder_count: number;
      }>(
        `
          with expired_due as (
            select id
            from policy_activation_requests
            where status = 'pending' and expires_at <= now()
            order by expires_at asc
            for update skip locked
            limit 50
          )
          update policy_activation_requests par
          set status = 'expired',
              reviewed_at = now(),
              review_reason = 'Activation request expired before independent review.'
          from expired_due due, policy_versions pv
          where par.id = due.id and par.version_id = pv.id
          returning par.id, par.organization_id, par.policy_id, par.version_id,
                    pv.name as policy_name, pv.version_number,
                    par.requested_by_email, par.expires_at, par.reminder_count
        `,
      );

      const reminderResult = await client.query<{
        id: string;
        organization_id: string;
        policy_id: string;
        version_id: string;
        policy_name: string;
        version_number: number;
        requested_by_email: string;
        expires_at: Date;
        reminder_count: number;
      }>(
        `
          select par.id, par.organization_id, par.policy_id, par.version_id,
                 pv.name as policy_name, pv.version_number,
                 par.requested_by_email, par.expires_at, par.reminder_count
          from policy_activation_requests par
          join policy_versions pv on pv.id = par.version_id
          where par.status = 'pending'
            and par.expires_at > now()
            and par.next_reminder_at <= now()
          order by par.next_reminder_at asc
          for update of par skip locked
          limit 50
        `,
      );

      for (const row of reminderResult.rows) {
        await client.query(
          `
            update policy_activation_requests
            set reminder_count = reminder_count + 1,
                last_reminded_at = now(),
                escalated_at = case
                  when reminder_count >= 1 then coalesce(escalated_at, now())
                  else escalated_at
                end,
                next_reminder_at = least(
                  expires_at,
                  now() + ($2 * interval '1 minute')
                )
            where id = $1 and status = 'pending'
          `,
          [row.id, env.POLICY_ACTIVATION_REMINDER_MINUTES],
        );
      }

      const expired: PolicyNotification[] = expiredResult.rows.map((row) => ({
        kind: "expired",
        requestId: row.id,
        organizationId: row.organization_id,
        policyId: row.policy_id,
        policyName: row.policy_name,
        versionId: row.version_id,
        versionNumber: row.version_number,
        requestedBy: row.requested_by_email,
        expiresAt: row.expires_at,
        reminderCount: row.reminder_count,
      }));
      const reminders: PolicyNotification[] = reminderResult.rows.map((row) => ({
        kind: row.reminder_count >= 1 ? "escalation" : "reminder",
        requestId: row.id,
        organizationId: row.organization_id,
        policyId: row.policy_id,
        policyName: row.policy_name,
        versionId: row.version_id,
        versionNumber: row.version_number,
        requestedBy: row.requested_by_email,
        expiresAt: row.expires_at,
        reminderCount: row.reminder_count + 1,
      }));
      const notifications = [...expired, ...reminders];
      let enqueued = 0;
      for (const notification of notifications) {
        const outbox = await enqueuePolicyActivationNotification(client, {
          organizationId: notification.organizationId,
          sequence: notification.kind === "expired" ? 0 : notification.reminderCount,
          payload: {
            kind: notification.kind,
            requestId: notification.requestId,
            policyId: notification.policyId,
            policyName: notification.policyName,
            versionId: notification.versionId,
            versionNumber: notification.versionNumber,
            requestedBy: notification.requestedBy,
            expiresAt: notification.expiresAt.toISOString(),
            reminderCount: notification.reminderCount,
          },
        });
        if (outbox.enqueued) enqueued += 1;
        await appendAuditEvent(client, {
          organizationId: notification.organizationId,
          requestId: null,
          eventType:
            notification.kind === "expired"
              ? "policy.activation_expired"
              : notification.kind === "escalation"
                ? "policy.activation_escalated"
                : "policy.activation_reminder_queued",
          actorType: "system",
          actorId: "policy-reminder-dispatcher",
          payload: {
            activationRequestId: notification.requestId,
            policyId: notification.policyId,
            policyName: notification.policyName,
            versionId: notification.versionId,
            versionNumber: notification.versionNumber,
            expiresAt: notification.expiresAt.toISOString(),
            reminderCount: notification.reminderCount,
            notificationOutboxId: outbox.id,
            notificationEnqueued: outbox.enqueued,
          },
        });
      }
      return { notifications, enqueued };
    });

    return NextResponse.json({
      processed: notifications.notifications.length,
      enqueued: notifications.enqueued,
      reminders: notifications.notifications.filter((notification) => notification.kind === "reminder").length,
      escalations: notifications.notifications.filter((notification) => notification.kind === "escalation").length,
      expired: notifications.notifications.filter((notification) => notification.kind === "expired").length,
    });
  } catch (error) {
    return apiError(error);
  }
}

export const GET = dispatchPolicyActivationReminders;
export const POST = dispatchPolicyActivationReminders;
