import { describe, expect, it } from "vitest";
import {
  releaseGovernanceCountdown,
  releaseGovernanceUrgency,
} from "./release-governance-queue";

const now = Date.parse("2026-08-05T00:00:00.000Z");

describe("release governance queue", () => {
  it("escalates pending reviews as their deadline approaches", () => {
    expect(releaseGovernanceUrgency({ status: "pending", expiresAt: "2026-08-06T00:00:01.000Z" }, now)).toBe("on_track");
    expect(releaseGovernanceUrgency({ status: "pending", expiresAt: "2026-08-05T08:00:00.000Z" }, now)).toBe("urgent");
    expect(releaseGovernanceUrgency({ status: "pending", expiresAt: "2026-08-05T03:00:00.000Z" }, now)).toBe("escalated");
    expect(releaseGovernanceUrgency({ status: "pending", expiresAt: "2026-08-04T23:59:59.000Z" }, now)).toBe("overdue");
  });

  it("prioritizes worker and failure states over the deadline", () => {
    expect(releaseGovernanceUrgency({ status: "executing", expiresAt: "2026-08-04T00:00:00.000Z" }, now)).toBe("executing");
    expect(releaseGovernanceUrgency({ status: "failed", expiresAt: "2026-08-06T00:00:00.000Z" }, now)).toBe("failed");
  });

  it("formats a concise countdown", () => {
    expect(releaseGovernanceCountdown("2026-08-06T02:30:00.000Z", now)).toBe("1d 2h remaining");
    expect(releaseGovernanceCountdown("2026-08-05T03:15:00.000Z", now)).toBe("3h 15m remaining");
    expect(releaseGovernanceCountdown("2026-08-04T23:59:00.000Z", now)).toBe("Review deadline passed");
  });
});
