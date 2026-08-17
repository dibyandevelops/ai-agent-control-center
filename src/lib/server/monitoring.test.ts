import { describe, expect, it } from "vitest";
import {
  createStructuredLog,
  redactSensitiveData,
} from "./monitoring-core";

describe("structured monitoring and error logging", () => {
  it("redacts sensitive keys such as password, token, apikey", () => {
    const raw = {
      user: "admin@sentinelops.test",
      password: "SuperSecretPassword123!",
      apiKey: "sop_live_1234567890abcdef",
      metadata: {
        token: "sos_session_987654321",
        nested: {
          secret: "very-secret-value",
          normalField: "visible",
        },
      },
    };

    const redacted = redactSensitiveData(raw) as Record<string, unknown>;
    expect(redacted.password).toBe("[REDACTED]");
    expect(redacted.apiKey).toBe("[REDACTED]");
    const meta = redacted.metadata as Record<string, unknown>;
    expect(meta.token).toBe("[REDACTED]");
    const nested = meta.nested as Record<string, unknown>;
    expect(nested.secret).toBe("[REDACTED]");
    expect(nested.normalField).toBe("visible");
  });

  it("redacts credentials inside string messages", () => {
    const message = "Failed to authenticate request with token sop_live_a1b2c3d4e5f6g7h8 and session sos_session_z9y8x7w6";
    const redacted = redactSensitiveData(message);
    expect(redacted).toBe("Failed to authenticate request with token sop_live_[REDACTED] and session sos_session_[REDACTED]");
  });

  it("creates structured log entry with metadata and error fields", () => {
    const err = new Error("Database query failed with password=xyz");
    const entry = createStructuredLog("error", "Failed to process request", err, {
      organizationId: "org-123",
      operatorId: "op-456",
      route: "/api/v1/actions/evaluate",
    });

    expect(entry.level).toBe("error");
    expect(entry.service).toBe("sentinelops-control-plane");
    expect(entry.organizationId).toBe("org-123");
    expect(entry.operatorId).toBe("op-456");
    expect(entry.route).toBe("/api/v1/actions/evaluate");
    expect(entry.error?.name).toBe("Error");
    expect(entry.error?.message).toContain("Database query failed");
  });
});
