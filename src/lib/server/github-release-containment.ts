import "server-only";

import type { PoolClient } from "pg";

export interface ActiveReleaseContainment {
  id: string;
  status: "open" | "acknowledged";
  reason: string;
  detected_at: Date;
}

export async function findActiveReleaseContainment(
  client: PoolClient,
  input: { organizationId: string; resource: string },
) {
  const result = await client.query<ActiveReleaseContainment>(
    `
      select id, status, reason, detected_at
      from github_release_drift_incidents
      where organization_id = $1
        and severity = 'critical'
        and status in ('open', 'acknowledged')
        and lower(containment_resource) = lower($2)
      order by detected_at desc
      limit 1
    `,
    [input.organizationId, input.resource],
  );
  return result.rows[0] ?? null;
}

export function releaseContainmentMessage(incidentId: string) {
  return `Release automation is frozen by critical GitHub incident ${incidentId}. Acknowledge and resolve the incident before continuing.`;
}
