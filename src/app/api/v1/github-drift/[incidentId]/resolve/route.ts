import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendAuditEvent } from "@/lib/server/audit";
import { getOperatorSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { ConflictError, NotFoundError } from "@/lib/server/errors";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { runApprovedDraftGovernanceWorker } from "@/lib/server/release-governance-worker";

export const maxDuration = 60;

const resolutionSchema = z.object({
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
    const input = resolutionSchema.parse(await request.json());
    const result = await withTransaction(async (client) => {
      const incidentResult = await client.query<{
        id: string;
        action_request_id: string | null;
        containment_resource: string;
        repository: string;
        tag_name: string;
        event_action: string;
        severity: "high" | "critical";
        status: string;
      }>(
        `
          select id, action_request_id, containment_resource, repository,
                 tag_name, event_action, severity, status
          from github_release_drift_incidents
          where id = $1 and organization_id = $2
          for update
        `,
        [incidentId, operator.organizationId],
      );
      const incident = incidentResult.rows[0];
      if (!incident) throw new NotFoundError("GitHub drift incident not found.");
      if (incident.status === "open") {
        throw new ConflictError("Acknowledge this incident before resolving it.");
      }
      if (incident.status !== "acknowledged") {
        throw new ConflictError("This GitHub drift incident was already resolved.");
      }
      await client.query(
        `
          update github_release_drift_incidents
          set status = 'resolved', resolved_by_operator_id = $2,
              resolved_by_email = $3, resolved_at = now(),
              resolution_note = $4
          where id = $1 and status = 'acknowledged'
        `,
        [incident.id, operator.id, operator.email, input.note],
      );
      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId: incident.action_request_id,
        eventType: "github.release_containment_resolved",
        actorType: "human",
        actorId: operator.email,
        payload: {
          status: "resolved",
          incidentId: incident.id,
          repository: incident.repository,
          tagName: incident.tag_name,
          resource: incident.containment_resource,
          eventAction: incident.event_action,
          severity: incident.severity,
          note: input.note,
        },
      });
      const resumable = await client.query<{ id: string }>(
        `
          select governance.id
          from release_draft_governance_requests governance
          join action_requests action on action.id = governance.action_request_id
          where governance.organization_id = $1
            and governance.status = 'approved'
            and lower(action.resource) = lower($2)
          order by governance.requested_at asc
          limit 25
        `,
        [operator.organizationId, incident.containment_resource],
      );
      return {
        id: incident.id,
        status: "resolved" as const,
        resumableGovernanceIds: resumable.rows.map((row) => row.id),
      };
    });
    if (result.resumableGovernanceIds.length) {
      after(async () => {
        for (const governanceId of result.resumableGovernanceIds) {
          try {
            await runApprovedDraftGovernanceWorker({ governanceId, limit: 1 });
          } catch (error) {
            console.error("Resolved containment operation failed to resume", error);
          }
        }
      });
    }
    return NextResponse.json({
      id: result.id,
      status: result.status,
      resumedOperations: result.resumableGovernanceIds.length,
    });
  } catch (error) {
    return apiError(error);
  }
}
