import { describe, expect, it } from "vitest";
import {
  notificationFailureStatus,
  retryDelaySeconds,
} from "./notification-outbox-core";

describe("notification outbox retry policy", () => {
  it("uses exponential backoff capped at six hours", () => {
    expect([1, 2, 3, 4, 5, 20].map(retryDelaySeconds)).toEqual([
      60,
      120,
      240,
      480,
      960,
      21_600,
    ]);
  });

  it("dead-letters a notification after its final attempt", () => {
    expect(notificationFailureStatus(4, 5)).toBe("pending");
    expect(notificationFailureStatus(5, 5)).toBe("dead");
  });
});
