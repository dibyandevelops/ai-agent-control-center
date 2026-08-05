import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { ConflictError, NotFoundError } from "@/lib/server/errors";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";

const acknowledgmentSchema = z.object({
  note: z.string().trim().min(3).max(1_000),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ incidentId: string }> },
) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "govern_releases")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    const { incidentId } = await context.params;
    const input = acknowledgmentSchema.parse(await request.json());
    const result = await withTransaction(async (client) => {
      const incidentResult = await client.query<{
        id: string;
        action_request_id: string | null;
        repository: string;
        tag_name: string;
        event_action: string;
        severity: "high" | "critical";
        status: string;
      }>(
        `
          select id, action_request_id, repository, tag_name, event_action,
                 severity, status
          from github_release_drift_incidents
          where id = $1 and organization_id = $2
          for update
        `,
        [incidentId, operator.organizationId],
      );
      const incident = incidentResult.rows[0];
      if (!incident) throw new NotFoundError("GitHub drift incident not found.");
      if (incident.status !== "open") {
        throw new ConflictError("This GitHub drift incident was already acknowledged.");
      }
      await client.query(
        `
          update github_release_drift_incidents
          set status = 'acknowledged', acknowledged_by_operator_id = $2,
              acknowledged_by_email = $3, acknowledged_at = now(),
              acknowledgment_note = $4
          where id = $1
        `,
        [incident.id, operator.id, operator.email, input.note],
      );
      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId: incident.action_request_id,
        eventType: "github.release_drift_acknowledged",
        actorType: "human",
        actorId: operator.email,
        payload: {
          status: "acknowledged",
          incidentId: incident.id,
          repository: incident.repository,
          tagName: incident.tag_name,
          eventAction: incident.event_action,
          note: input.note,
        },
      });
      return {
        id: incident.id,
        status: "acknowledged" as const,
        containmentActive: incident.severity === "critical",
      };
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
