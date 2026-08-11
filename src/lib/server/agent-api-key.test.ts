import { describe, expect, it } from "vitest";
import {
  defaultAgentApiKeyExpirationDays,
  generateAgentApiKey,
  getAgentApiKeyExpiresAt,
  getAgentApiKeyPrefix,
  getAgentApiKeyStatus,
  hashAgentApiKey,
  isAgentApiKeyExpirationDays,
} from "./agent-api-key";

describe("agent API keys", () => {
  it("generates unique 256-bit bearer credentials", () => {
    const keys = new Set(
      Array.from({ length: 32 }, () => generateAgentApiKey()),
    );
    expect(keys.size).toBe(32);
    for (const key of keys) {
      expect(key).toMatch(/^sop_live_[A-Za-z0-9_-]{43}$/);
    }
  });

  it("creates a stable SHA-256 hash without retaining plaintext", () => {
    const key = generateAgentApiKey();
    const hash = hashAgentApiKey(key);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(hashAgentApiKey(key));
    expect(hash).not.toContain(key);
  });

  it("exposes only the non-sensitive key prefix", () => {
    const key = generateAgentApiKey();
    const prefix = getAgentApiKeyPrefix(key);
    expect(prefix).toBe(key.slice(0, 16));
    expect(prefix.length).toBeLessThan(key.length);
  });

  it("supports bounded enterprise credential lifetimes", () => {
    expect(defaultAgentApiKeyExpirationDays).toBe(90);
    expect(isAgentApiKeyExpirationDays(30)).toBe(true);
    expect(isAgentApiKeyExpirationDays(365)).toBe(true);
    expect(isAgentApiKeyExpirationDays(0)).toBe(false);
    expect(isAgentApiKeyExpirationDays(366)).toBe(false);
    expect(
      getAgentApiKeyExpiresAt(90, new Date("2026-08-11T00:00:00.000Z")),
    ).toEqual(new Date("2026-11-09T00:00:00.000Z"));
  });

  it("distinguishes active, expired, and explicitly revoked keys", () => {
    const now = Date.parse("2026-08-11T00:00:00.000Z");
    expect(
      getAgentApiKeyStatus(null, new Date("2026-08-12T00:00:00.000Z"), now),
    ).toBe("active");
    expect(
      getAgentApiKeyStatus(null, new Date("2026-08-10T00:00:00.000Z"), now),
    ).toBe("expired");
    expect(
      getAgentApiKeyStatus(
        new Date("2026-08-09T00:00:00.000Z"),
        new Date("2026-08-12T00:00:00.000Z"),
        now,
      ),
    ).toBe("revoked");
  });
});
