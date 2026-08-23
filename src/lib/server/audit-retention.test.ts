import { describe, expect, it } from "vitest";
import {
  calculateAuditEventHash,
  type AuditChainEvent,
  verifyAuditChain,
} from "./audit-chain";

describe("audit retention and checkpointing logic", () => {
  it("calculates retention cutoff accurately", () => {
    const now = new Date("2026-08-23T12:00:00Z");
    const retentionDays = 90;
    const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
    expect(cutoff.toISOString()).toBe("2026-05-25T12:00:00.000Z");
  });

  it("verifies chain continuity when historical range is sealed into a checkpoint", () => {
    // 1. Generate historical events (to be pruned)
    const event1: AuditChainEvent = {
      id: "1",
      requestId: null,
      eventType: "operator.created",
      actorType: "human",
      actorId: "admin@company.com",
      payload: { role: "admin" },
      previousHash: null,
      eventHash: "",
    };
    event1.eventHash = calculateAuditEventHash(null, event1);

    const event2: AuditChainEvent = {
      id: "2",
      requestId: null,
      eventType: "policy.created",
      actorType: "human",
      actorId: "admin@company.com",
      payload: { name: "Prod policy" },
      previousHash: event1.eventHash,
      eventHash: "",
    };
    event2.eventHash = calculateAuditEventHash(event1.eventHash, event2);

    // Terminal hash of the pruned range is event2.eventHash
    const checkpointTerminalHash = event2.eventHash;

    // 2. Generate live events (created after retention cutoff)
    const event3: AuditChainEvent = {
      id: "3",
      requestId: null,
      eventType: "audit.retention_pruned",
      actorType: "system",
      actorId: "sentinelops-retention-worker",
      payload: {
        checkpointId: "cp-1",
        startEventId: "1",
        endEventId: "2",
        terminalHash: checkpointTerminalHash,
        eventCount: 2,
      },
      previousHash: checkpointTerminalHash,
      eventHash: "",
    };
    event3.eventHash = calculateAuditEventHash(checkpointTerminalHash, event3);

    const event4: AuditChainEvent = {
      id: "4",
      requestId: "req-1",
      eventType: "action.evaluated",
      actorType: "agent",
      actorId: "agent-alpha",
      payload: { status: "allowed" },
      previousHash: event3.eventHash,
      eventHash: "",
    };
    event4.eventHash = calculateAuditEventHash(event3.eventHash, event4);

    // Full chain verification before pruning
    const fullChain = [event1, event2, event3, event4];
    expect(verifyAuditChain(fullChain)).toEqual({
      verified: true,
      firstInvalidEventId: null,
    });

    // Pruned chain (only live events remaining)
    const liveChain = [event3, event4];

    // Live chain fails if checkpoint is missing (since event3 points to event2's hash)
    expect(verifyAuditChain(liveChain)).toEqual({
      verified: false,
      firstInvalidEventId: "3",
    });

    // Live chain passes when anchored by the checkpoint
    expect(
      verifyAuditChain(liveChain, {
        checkpoints: [{ terminalHash: checkpointTerminalHash }],
      }),
    ).toEqual({
      verified: true,
      firstInvalidEventId: null,
    });
  });
});
