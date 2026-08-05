export function retryDelaySeconds(attemptCount: number) {
  const normalizedAttempt = Math.max(1, Math.floor(attemptCount));
  return Math.min(21_600, 60 * 2 ** (normalizedAttempt - 1));
}

export function notificationFailureStatus(
  attemptCount: number,
  maxAttempts: number,
) {
  return attemptCount >= maxAttempts ? "dead" as const : "pending" as const;
}

export function formatGitHubAppLifecycleSlackText(input: {
  installationId: string;
  accountLogin: string;
  change: "suspended" | "disconnected" | "repository_access_removed";
  severity: "high" | "critical";
  actorLogin: string;
  repositories: string[];
  remediationUrl: string;
}) {
  const heading = input.change === "suspended"
    ? "GitHub App installation suspended"
    : input.change === "disconnected"
      ? "GitHub App installation disconnected"
      : "GitHub repository access removed";
  return [
    `SentinelOps — ${input.severity.toUpperCase()}: ${heading}`,
    `GitHub account: ${input.accountLogin}`,
    `Installation: ${input.installationId}`,
    `Changed by: @${input.actorLogin}`,
    ...(input.repositories.length > 0
      ? [`Affected repositories: ${input.repositories.join(", ")}`]
      : []),
    `Review and remediate: ${input.remediationUrl}`,
  ].join("\n");
}
