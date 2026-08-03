import "server-only";

import type { PoolClient } from "pg";
import { calculateAuditEventHash } from "./audit-chain";

interface AppendAuditEventInput {
  organizationId: string;
  requestId: string | null;
  eventType: string;
  actorType: "agent" | "policy" | "human" | "system";
  actorId: string;
  payload: Record<string, unknown>;
}

export async function appendAuditEvent(
  client: PoolClient,
  input: AppendAuditEventInput,
) {
  await client.query("select pg_advisory_xact_lock(hashtext($1))", [
    input.organizationId,
  ]);
  const previousResult = await client.query<{ event_hash: string }>(
    `
      select event_hash
      from audit_events
      where organization_id = $1
      order by id desc
      limit 1
    `,
    [input.organizationId],
  );
  const previousHash = previousResult.rows[0]?.event_hash ?? null;
  const eventHash = calculateAuditEventHash(previousHash, input);

  await client.query(
    `
      insert into audit_events (
        organization_id,
        request_id,
        event_type,
        actor_type,
        actor_id,
        payload,
        previous_hash,
        event_hash
      )
      values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
    `,
    [
      input.organizationId,
      input.requestId,
      input.eventType,
      input.actorType,
      input.actorId,
      JSON.stringify(input.payload),
      previousHash,
      eventHash,
    ],
  );

  return eventHash;
}
