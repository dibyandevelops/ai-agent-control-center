import { describe, expect, it } from "vitest";
import {
  createScimBearerToken,
  emailMatchesAllowedDomains,
  hashScimBearerToken,
  normalizeAllowedDomains,
} from "./identity-core";

describe("identity provisioning helpers", () => {
  it("normalizes and deduplicates company domains", () => {
    expect(normalizeAllowedDomains(["@ApertureLabs.com", "aperturelabs.com", "ops.example"])).toEqual([
      "aperturelabs.com",
      "ops.example",
    ]);
  });

  it("enforces configured domains without blocking an unconfigured tenant", () => {
    expect(emailMatchesAllowedDomains("maya@aperturelabs.com", ["aperturelabs.com"])).toBe(true);
    expect(emailMatchesAllowedDomains("maya@outside.example", ["aperturelabs.com"])).toBe(false);
    expect(emailMatchesAllowedDomains("maya@outside.example", [])).toBe(true);
  });

  it("creates high-entropy SCIM tokens and only stores their hash", () => {
    const token = createScimBearerToken();
    expect(token).toMatch(/^sos_scim_[A-Za-z0-9_-]{43}$/);
    expect(hashScimBearerToken(token)).toHaveLength(64);
  });
});
