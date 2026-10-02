import { describe, expect, it } from "vitest";
import { subscriptionGrantsPaidAccess } from "./paddle-access";

describe("subscriptionGrantsPaidAccess", () => {
  it("grants access only to active and trialing subscriptions", () => {
    expect(subscriptionGrantsPaidAccess({ status: "active" })).toBe(true);
    expect(subscriptionGrantsPaidAccess({ status: "trialing" })).toBe(true);
    for (const status of ["paused", "past_due", "canceled", "inactive", "unknown"]) {
      expect(subscriptionGrantsPaidAccess({ status })).toBe(false);
    }
  });

  it("does not revoke access for a scheduled pause or cancellation", () => {
    expect(subscriptionGrantsPaidAccess({ status: "active", scheduledChangeAction: "cancel" })).toBe(true);
    expect(subscriptionGrantsPaidAccess({ status: "trialing", scheduledChangeAction: "pause" })).toBe(true);
  });
});
