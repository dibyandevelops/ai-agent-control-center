import { describe, expect, it } from "vitest";
import {
  generateAgentApiKey,
  getAgentApiKeyPrefix,
  hashAgentApiKey,
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
});

