import { signHttpsWebhookBody } from "@/lib/https-webhook-core";

export type SiemProvider = "datadog" | "splunk" | "webhook";

export interface SiemAuditEvent {
  id: string;
  organizationId: string;
  agentId: string;
  agentName?: string;
  action: string;
  resource?: string;
  environment?: string;
  decision: "ALLOWED" | "REJECTED" | "APPROVAL_REQUIRED";
  reason?: string;
  actor?: string;
  sha256Hash: string;
  previousHash?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SiemDestinationConfig {
  provider: SiemProvider;
  endpointUrl: string;
  apiKey?: string; // Datadog DD-API-KEY or Splunk HEC token
  signingSecret?: string; // For generic HMAC-signed webhooks
  index?: string; // Splunk target index (default: "main")
  service?: string; // Datadog service (default: "sentinelops")
  tags?: string[]; // Datadog tags (e.g. ["env:prod", "team:secops"])
}

export interface SiemForwardResult {
  success: boolean;
  provider: SiemProvider;
  statusCode?: number;
  latencyMs: number;
  error?: string;
}

/**
 * Formats a SentinelOps audit event for Datadog Logs API v2.
 * Reference: https://docs.datadoghq.com/api/latest/logs/#send-logs
 */
export function formatDatadogPayload(
  config: SiemDestinationConfig,
  event: SiemAuditEvent
): { body: string; headers: Record<string, string> } {
  const timestampMs = new Date(event.timestamp).getTime() || Date.now();
  const defaultTags = [
    `org:${event.organizationId}`,
    `agent:${event.agentId}`,
    `decision:${event.decision.toLowerCase()}`,
    `action:${event.action}`,
  ];
  const combinedTags = [...defaultTags, ...(config.tags || [])].join(",");

  const payload = [
    {
      ddsource: "sentinelops",
      ddtags: combinedTags,
      service: config.service || "sentinelops-control-plane",
      hostname: "sentinelops.dev",
      timestamp: timestampMs,
      message: `[SentinelOps Audit] Agent ${event.agentId} performed '${event.action}' -> ${event.decision}`,
      sentinelops: {
        auditId: event.id,
        organizationId: event.organizationId,
        agentId: event.agentId,
        agentName: event.agentName,
        action: event.action,
        resource: event.resource,
        environment: event.environment,
        decision: event.decision,
        reason: event.reason,
        actor: event.actor,
        integrity: {
          sha256Hash: event.sha256Hash,
          previousHash: event.previousHash,
        },
        metadata: event.metadata,
      },
    },
  ];

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.apiKey) {
    headers["DD-API-KEY"] = config.apiKey;
  }

  return {
    body: JSON.stringify(payload),
    headers,
  };
}

/**
 * Formats a SentinelOps audit event for Splunk HTTP Event Collector (HEC).
 * Reference: https://docs.splunk.com/Documentation/Splunk/latest/Data/HECWalkthrough
 */
export function formatSplunkHecPayload(
  config: SiemDestinationConfig,
  event: SiemAuditEvent
): { body: string; headers: Record<string, string> } {
  const timeSeconds = Math.floor((new Date(event.timestamp).getTime() || Date.now()) / 1000);

  const payload = {
    time: timeSeconds,
    host: "sentinelops.dev",
    source: "sentinelops:audit",
    sourcetype: "sentinelops:audit:json",
    index: config.index || "main",
    event: {
      id: event.id,
      organizationId: event.organizationId,
      agentId: event.agentId,
      agentName: event.agentName,
      action: event.action,
      resource: event.resource,
      environment: event.environment,
      decision: event.decision,
      reason: event.reason,
      actor: event.actor,
      timestamp: event.timestamp,
      cryptographicSeal: {
        sha256Hash: event.sha256Hash,
        previousHash: event.previousHash,
      },
      metadata: event.metadata,
    },
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Splunk ${config.apiKey}`;
  }

  return {
    body: JSON.stringify(payload),
    headers,
  };
}

/**
 * Formats a SentinelOps audit event for generic HTTPS webhooks with HMAC-SHA256 signature.
 */
export function formatWebhookPayload(
  config: SiemDestinationConfig,
  event: SiemAuditEvent
): { body: string; headers: Record<string, string> } {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({
    event: "audit.event.created",
    timestamp: event.timestamp,
    data: event,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-sentinelops-timestamp": timestamp,
    "x-sentinelops-delivery-id": `siem_${event.id}`,
    "x-sentinelops-event": "audit.event.created",
  };

  if (config.signingSecret) {
    headers["x-sentinelops-signature"] = signHttpsWebhookBody({
      secret: config.signingSecret,
      timestamp,
      body,
    });
  }

  return { body, headers };
}

/**
 * Unified formatter dispatching to provider-specific serialization.
 */
export function formatSiemPayload(
  config: SiemDestinationConfig,
  event: SiemAuditEvent
): { body: string; headers: Record<string, string> } {
  switch (config.provider) {
    case "datadog":
      return formatDatadogPayload(config, event);
    case "splunk":
      return formatSplunkHecPayload(config, event);
    case "webhook":
    default:
      return formatWebhookPayload(config, event);
  }
}

/**
 * Streams an audit event to the configured enterprise SIEM endpoint.
 */
export async function forwardAuditEventToSiem(
  config: SiemDestinationConfig,
  event: SiemAuditEvent,
  fetchFn = fetch
): Promise<SiemForwardResult> {
  const start = performance.now();
  const { body, headers } = formatSiemPayload(config, event);

  try {
    const response = await fetchFn(config.endpointUrl, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(10000),
    });

    const latencyMs = Math.round(performance.now() - start);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        success: false,
        provider: config.provider,
        statusCode: response.status,
        latencyMs,
        error: `SIEM endpoint returned HTTP ${response.status}: ${errorText.slice(0, 200)}`,
      };
    }

    return {
      success: true,
      provider: config.provider,
      statusCode: response.status,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    return {
      success: false,
      provider: config.provider,
      latencyMs,
      error: err instanceof Error ? err.message : "Unknown SIEM streaming failure",
    };
  }
}
