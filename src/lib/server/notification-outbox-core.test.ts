import { describe, expect, it } from "vitest";
import {
  formatGitHubAppLifecycleSlackText,
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

  it("formats an actionable GitHub App lifecycle alert", () => {
    const text = formatGitHubAppLifecycleSlackText({
      installationId: "151404943",
      accountLogin: "aperture-labs",
      change: "repository_access_removed",
      severity: "high",
      actorLogin: "security-admin",
      repositories: ["aperture-labs/payments"],
      remediationUrl: "https://sentinelops.example/dashboard?view=integrations",
    });
    expect(text).toContain("HIGH: GitHub repository access removed");
    expect(text).toContain("aperture-labs/payments");
    expect(text).toContain("@security-admin");
    expect(text).toContain("https://sentinelops.example/dashboard?view=integrations");
  });
});
