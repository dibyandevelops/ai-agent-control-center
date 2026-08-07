export const slackEventTypes = [
  "action.approval_requested",
  "action.execution_failed",
  "policy.activation",
  "release.draft_governance_requested",
  "github.release_drift_detected",
  "github.app_lifecycle_alert",
  "security.daily_digest",
] as const;

export type SlackEventType = (typeof slackEventTypes)[number];

export const slackSeverities = [
  "info",
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type SlackSeverity = (typeof slackSeverities)[number];

const severityRank = new Map(
  slackSeverities.map((severity, index) => [severity, index]),
);

export interface SlackRouteCandidate {
  id: string;
  isDefault: boolean;
  eventTypes: string[];
  minimumSeverity: SlackSeverity;
}

export function normalizeSlackEventType(eventType: string): SlackEventType {
  if (eventType.startsWith("policy.activation_")) return "policy.activation";
  if ((slackEventTypes as readonly string[]).includes(eventType)) {
    return eventType as SlackEventType;
  }
  throw new Error(`Unsupported Slack notification event: ${eventType}`);
}

export function selectSlackRoutes(
  candidates: SlackRouteCandidate[],
  eventType: SlackEventType,
  severity: SlackSeverity,
) {
  const eventSeverity = severityRank.get(severity) ?? 0;
  const specialized = candidates.filter(
    (candidate) =>
      !candidate.isDefault &&
      candidate.eventTypes.includes(eventType) &&
      eventSeverity >= (severityRank.get(candidate.minimumSeverity) ?? 0),
  );
  if (specialized.length > 0) return specialized;
  const fallback = candidates.find((candidate) => candidate.isDefault);
  return fallback ? [fallback] : [];
}

export function shouldRevokeSlackWorkspaceToken(siblingDestinationCount: number) {
  return siblingDestinationCount === 0;
}
