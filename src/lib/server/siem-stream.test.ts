import { describe, expect, it, vi } from "vitest";
import {
  formatDatadogPayload,
  formatSplunkHecPayload,
  formatWebhookPayload,
  forwardAuditEventToSiem,
  type SiemAuditEvent,
  type SiemDestinationConfig,
} from "./siem-stream";
import { verifyHttpsWebhookSignature } from "@/lib/https-webhook-core";

const mockEvent: SiemAuditEvent = {
  id: "aud_998877",
  organizationId: "org_enterprise_alpha",
  agentId: "agent_wire_transfer_01",
  agentName: "FinOps Transfer Agent",
  action: "stripe.transfers.create",
  resource: "acct_123456",
  environment: "production",
  decision: "ALLOWED",
  reason: "Within daily authorized limit",
  actor: "agent_service_account",
  sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  previousHash: "0000000000000000000000000000000000000000000000000000000000000000",
  timestamp: "2026-09-07T12:00:00.000Z",
  metadata: { amount: 50000, currency: "USD" },
};

describe("Enterprise SIEM Forwarder - Formatting", () => {
  it("formats Datadog Logs API payload with correct metadata and headers", () => {
    const config: SiemDestinationConfig = {
      provider: "datadog",
      endpointUrl: "https://http-intake.logs.datadoghq.com/api/v2/logs",
      apiKey: "dd_api_key_test_123",
      service: "sentinelops-agent-gateway",
      tags: ["env:production", "tier:tier-0"],
    };

    const { body, headers } = formatDatadogPayload(config, mockEvent);

    expect(headers["DD-API-KEY"]).toBe("dd_api_key_test_123");
    expect(headers["Content-Type"]).toBe("application/json");

    const parsed = JSON.parse(body);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].ddsource).toBe("sentinelops");
    expect(parsed[0].service).toBe("sentinelops-agent-gateway");
    expect(parsed[0].ddtags).toContain("org:org_enterprise_alpha");
    expect(parsed[0].ddtags).toContain("env:production");
    expect(parsed[0].sentinelops.auditId).toBe("aud_998877");
    expect(parsed[0].sentinelops.integrity.sha256Hash).toBe(mockEvent.sha256Hash);
  });

  it("formats Splunk HTTP Event Collector (HEC) payload with Authorization header", () => {
    const config: SiemDestinationConfig = {
      provider: "splunk",
      endpointUrl: "https://splunk-hec.corp.internal:8088/services/collector/event",
      apiKey: "hec_token_xyz_456",
      index: "security_audit",
    };

    const { body, headers } = formatSplunkHecPayload(config, mockEvent);

    expect(headers["Authorization"]).toBe("Splunk hec_token_xyz_456");
    expect(headers["Content-Type"]).toBe("application/json");

    const parsed = JSON.parse(body);
    expect(parsed.source).toBe("sentinelops:audit");
    expect(parsed.sourcetype).toBe("sentinelops:audit:json");
    expect(parsed.index).toBe("security_audit");
    expect(parsed.event.action).toBe("stripe.transfers.create");
    expect(parsed.event.cryptographicSeal.sha256Hash).toBe(mockEvent.sha256Hash);
  });

  it("formats generic HTTPS webhook with HMAC-SHA256 signature", () => {
    const secret = "swhsec_test_signing_key_super_secret_12345";
    const config: SiemDestinationConfig = {
      provider: "webhook",
      endpointUrl: "https://siem.corp.internal/webhooks/sentinelops",
      signingSecret: secret,
    };

    const { body, headers } = formatWebhookPayload(config, mockEvent);

    expect(headers["x-sentinelops-event"]).toBe("audit.event.created");
    expect(headers["x-sentinelops-signature"]).toMatch(/^v1=[a-f0-9]{64}$/);

    const isValid = verifyHttpsWebhookSignature({
      secret,
      timestamp: headers["x-sentinelops-timestamp"],
      body,
      signature: headers["x-sentinelops-signature"],
    });
    expect(isValid).toBe(true);
  });
});

describe("Enterprise SIEM Forwarder - Dispatch & Execution", () => {
  it("successfully streams audit event to SIEM endpoint when remote responds 200 OK", async () => {
    const config: SiemDestinationConfig = {
      provider: "datadog",
      endpointUrl: "https://http-intake.logs.datadoghq.com/api/v2/logs",
      apiKey: "fake_dd_key",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: () => Promise.resolve("{}"),
    });

    const result = await forwardAuditEventToSiem(config, mockEvent, mockFetch as unknown as typeof fetch);

    expect(result.success).toBe(true);
    expect(result.statusCode).toBe(202);
    expect(result.provider).toBe("datadog");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://http-intake.logs.datadoghq.com/api/v2/logs",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "DD-API-KEY": "fake_dd_key" }),
      })
    );
  });

  it("handles remote HTTP error gracefully and reports status code", async () => {
    const config: SiemDestinationConfig = {
      provider: "splunk",
      endpointUrl: "https://splunk.corp.internal:8088/services/collector/event",
      apiKey: "invalid_token",
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('{"text":"Invalid token","code":4}'),
    });

    const result = await forwardAuditEventToSiem(config, mockEvent, mockFetch as unknown as typeof fetch);

    expect(result.success).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.error).toContain("HTTP 401");
  });

  it("handles network failure / connection timeout gracefully", async () => {
    const config: SiemDestinationConfig = {
      provider: "webhook",
      endpointUrl: "https://unreachable.invalid",
    };

    const mockFetch = vi.fn().mockRejectedValue(new Error("Connection reset by peer"));

    const result = await forwardAuditEventToSiem(config, mockEvent, mockFetch as unknown as typeof fetch);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Connection reset by peer");
  });
});
