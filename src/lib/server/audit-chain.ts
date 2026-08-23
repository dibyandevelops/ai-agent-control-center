import { createHash } from "node:crypto";

export interface AuditHashInput {
  requestId: string | null;
  eventType: string;
  actorType: "agent" | "policy" | "human" | "system";
  actorId: string;
  payload: Record<string, unknown>;
}

export interface AuditChainEvent extends AuditHashInput {
  id: string;
  previousHash: string | null;
  eventHash: string;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function calculateAuditEventHash(
  previousHash: string | null,
  event: AuditHashInput,
) {
  return createHash("sha256")
    .update(
      stableJson({
        previousHash,
        requestId: event.requestId,
        eventType: event.eventType,
        actorType: event.actorType,
        actorId: event.actorId,
        payload: event.payload,
      }),
    )
    .digest("hex");
}

export function verifyAuditChain(
  events: AuditChainEvent[],
  options?: {
    initialPreviousHash?: string | null;
    checkpoints?: Array<{ terminalHash: string }>;
  },
) {
  if (events.length === 0) {
    return { verified: true, firstInvalidEventId: null };
  }

  let expectedPreviousHash: string | null = options?.initialPreviousHash ?? null;
  if (events[0].previousHash !== null && expectedPreviousHash === null && options?.checkpoints) {
    const matchingCheckpoint = options.checkpoints.find(
      (checkpoint) => checkpoint.terminalHash === events[0].previousHash,
    );
    if (matchingCheckpoint) {
      expectedPreviousHash = matchingCheckpoint.terminalHash;
    }
  }

  for (const event of events) {
    if (event.previousHash !== expectedPreviousHash) {
      return { verified: false, firstInvalidEventId: event.id };
    }
    const expectedHash = calculateAuditEventHash(expectedPreviousHash, event);
    if (event.eventHash !== expectedHash) {
      return { verified: false, firstInvalidEventId: event.id };
    }
    expectedPreviousHash = event.eventHash;
  }

  return { verified: true, firstInvalidEventId: null };
}
