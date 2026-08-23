import { describe, expect, it } from "vitest";
import {
  calculateAuditEventHash,
  type AuditChainEvent,
  verifyAuditChain,
} from "./audit-chain";

function createEvent(
  id: string,
  previousHash: string | null,
  payload: Record<string, unknown>,
): AuditChainEvent {
  const input = {
    requestId: "request-1",
    eventType: "action.approved",
    actorType: "human" as const,
    actorId: "operator@example.com",
    payload,
  };
  return {
    id,
    previousHash,
    eventHash: calculateAuditEventHash(previousHash, input),
    ...input,
  };
}

describe("audit chain verification", () => {
  it("verifies an intact ordered chain", () => {
    const first = createEvent("1", null, { decision: "approved" });
    const second = createEvent("2", first.eventHash, { status: "executing" });
    expect(verifyAuditChain([first, second])).toEqual({
      verified: true,
      firstInvalidEventId: null,
    });
  });

  it("detects modified event content", () => {
    const event = createEvent("1", null, { decision: "approved" });
    event.payload = { decision: "denied" };
    expect(verifyAuditChain([event])).toEqual({
      verified: false,
      firstInvalidEventId: "1",
    });
  });

  it("detects a broken previous-hash link", () => {
    const first = createEvent("1", null, { decision: "approved" });
    const second = createEvent("2", "wrong-hash", { status: "executing" });
    expect(verifyAuditChain([first, second])).toEqual({
      verified: false,
      firstInvalidEventId: "2",
    });
  });

  it("verifies a pruned chain anchored by a historical checkpoint", () => {
    const historicalTerminalHash = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
    const firstLiveEvent = createEvent("101", historicalTerminalHash, { status: "resumed" });
    const secondLiveEvent = createEvent("102", firstLiveEvent.eventHash, { status: "completed" });

    // Without checkpoint, firstLiveEvent has an unexpected non-null previousHash
    expect(verifyAuditChain([firstLiveEvent, secondLiveEvent])).toEqual({
      verified: false,
      firstInvalidEventId: "101",
    });

    // With matching checkpoint anchor, verification passes
    expect(
      verifyAuditChain([firstLiveEvent, secondLiveEvent], {
        checkpoints: [{ terminalHash: historicalTerminalHash }],
      }),
    ).toEqual({
      verified: true,
      firstInvalidEventId: null,
    });
  });
});
