import { NextResponse } from "next/server";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";

export async function POST() {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }
    if (!operatorCan(operator.role, "manage_policies")) {
      return NextResponse.json(
        { error: "Admin role required." },
        { status: 403 },
      );
    }

    const result = await withTransaction(async (client) => {
      const requeued = await client.query<{
        id: string;
        event_type: string;
        previous_attempt_count: number;
        previous_error: string | null;
      }>(
        `
          with candidates as (
            select id, attempt_count, last_error
            from notification_outbox
            where organization_id = $1
              and status = 'dead'
            order by updated_at asc, id asc
            for update skip locked
            limit 100
          )
          update notification_outbox outbox
          set status = 'pending',
              attempt_count = 0,
              available_at = now(),
              locked_at = null,
              locked_by = null,
              last_error = null,
              delivered_at = null,
              updated_at = now()
          from candidates
          where outbox.id = candidates.id
          returning outbox.id,
                    outbox.event_type,
                    candidates.attempt_count as previous_attempt_count,
                    candidates.last_error as previous_error
        `,
        [operator.organizationId],
      );

      for (const row of requeued.rows) {
        await appendAuditEvent(client, {
          organizationId: operator.organizationId,
          requestId: null,
          eventType: "notification.outbox_requeued",
          actorType: "human",
          actorId: operator.email,
          payload: {
            notificationId: row.id,
            notificationEvent: row.event_type,
            previousAttemptCount: row.previous_attempt_count,
            previousError: row.previous_error,
          },
        });
      }

      const remaining = await client.query<{ count: string }>(
        `
          select count(*)::text as count
          from notification_outbox
          where organization_id = $1 and status = 'dead'
        `,
        [operator.organizationId],
      );
      return {
        requeued: requeued.rowCount ?? requeued.rows.length,
        remainingDead: Number(remaining.rows[0]?.count ?? 0),
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
