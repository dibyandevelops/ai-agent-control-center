import "server-only";

import type { PoolClient } from "pg";
import { appendAuditEvent } from "./audit";
import { getPool, withTransaction } from "./db";

export interface AuditRetentionCheckpoint {
  id: string;
  organizationId: string;
  startEventId: string;
  endEventId: string;
  startTime: string;
  endTime: string;
  eventCount: number;
  terminalHash: string;
  prunedAt: string;
  createdAt: string;
}

interface CheckpointRow {
  id: string;
  organization_id: string;
  start_event_id: string;
  end_event_id: string;
  start_time: Date;
  end_time: Date;
  event_count: number;
  terminal_hash: string;
  pruned_at: Date;
  created_at: Date;
}

function toCheckpoint(row: CheckpointRow): AuditRetentionCheckpoint {
  return {
    id: row.id,
    organizationId: row.organization_id,
    startEventId: row.start_event_id,
    endEventId: row.end_event_id,
    startTime: row.start_time.toISOString(),
    endTime: row.end_time.toISOString(),
    eventCount: row.event_count,
    terminalHash: row.terminal_hash,
    prunedAt: row.pruned_at.toISOString(),
    createdAt: row.created_at.toISOString(),
  };
}

export async function listOrganizationAuditCheckpoints(organizationId: string) {
  const result = await getPool().query<CheckpointRow>(
    `select *
       from audit_retention_checkpoints
      where organization_id = $1
      order by end_time desc, created_at desc`,
    [organizationId],
  );
  return result.rows.map(toCheckpoint);
}

export async function pruneOrganizationAuditEvents(
  client: PoolClient,
  input: {
    organizationId: string;
    retentionDays?: number;
    batchSize?: number;
    now?: Date;
  },
) {
  await client.query("select pg_advisory_xact_lock(hashtext($1))", [
    input.organizationId,
  ]);

  let retentionDays = input.retentionDays;
  if (!retentionDays) {
    const orgResult = await client.query<{ audit_retention_days: number }>(
      `select audit_retention_days from organizations where id = $1 limit 1`,
      [input.organizationId],
    );
    retentionDays = orgResult.rows[0]?.audit_retention_days ?? 90;
  }

  const batchSize = Math.min(input.batchSize ?? 1000, 5000);
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const expiredEventsResult = await client.query<{
    id: string;
    created_at: Date;
    event_hash: string;
  }>(
    `select id::text, created_at, event_hash
       from audit_events
      where organization_id = $1
        and created_at < $2
      order by id asc
      limit $3`,
    [input.organizationId, cutoff, batchSize],
  );

  const rows = expiredEventsResult.rows;
  if (rows.length === 0) {
    return {
      pruned: false,
      eventCount: 0,
      checkpointId: null,
      terminalHash: null,
    };
  }

  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  const startEventId = firstRow.id;
  const endEventId = lastRow.id;
  const startTime = firstRow.created_at;
  const endTime = lastRow.created_at;
  const eventCount = rows.length;
  const terminalHash = lastRow.event_hash;

  const checkpointResult = await client.query<{ id: string }>(
    `insert into audit_retention_checkpoints (
       organization_id, start_event_id, end_event_id,
       start_time, end_time, event_count, terminal_hash
     )
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      input.organizationId,
      startEventId,
      endEventId,
      startTime,
      endTime,
      eventCount,
      terminalHash,
    ],
  );
  const checkpointId = checkpointResult.rows[0]?.id ?? null;

  await client.query(
    `delete from audit_events
      where organization_id = $1
        and id >= $2::bigint
        and id <= $3::bigint`,
    [input.organizationId, startEventId, endEventId],
  );

  await appendAuditEvent(client, {
    organizationId: input.organizationId,
    requestId: null,
    eventType: "audit.retention_pruned",
    actorType: "system",
    actorId: "sentinelops-retention-worker",
    payload: {
      checkpointId,
      startEventId,
      endEventId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      eventCount,
      terminalHash,
      retentionDays,
      cutoff: cutoff.toISOString(),
    },
  });

  return {
    pruned: true,
    eventCount,
    checkpointId,
    terminalHash,
    startEventId,
    endEventId,
  };
}

export async function runAuditRetentionWorker() {
  const pool = getPool();
  const orgsResult = await pool.query<{ id: string; name: string }>(
    `select id, name from organizations order by created_at asc`,
  );

  let organizationsProcessed = 0;
  let totalEventsPruned = 0;
  let checkpointsCreated = 0;

  for (const org of orgsResult.rows) {
    const outcome = await withTransaction(async (client) => {
      return pruneOrganizationAuditEvents(client, {
        organizationId: org.id,
      });
    });

    organizationsProcessed += 1;
    if (outcome.pruned) {
      totalEventsPruned += outcome.eventCount;
      checkpointsCreated += 1;
    }
  }

  return {
    organizationsProcessed,
    totalEventsPruned,
    checkpointsCreated,
  };
}
