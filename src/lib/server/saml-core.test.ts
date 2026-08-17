import { describe, expect, it } from "vitest";
import {
  createSamlRelayState,
  hashSamlRelayState,
  normalizeSamlCertificate,
  parseSamlCertificateExpiry,
} from "./saml-core";

describe("SAML SSO helpers", () => {
  it("creates a high-entropy relay state and deterministic hash", () => {
    const state = createSamlRelayState();
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hashSamlRelayState(state)).toHaveLength(64);
  });

  it("requires a PEM-formatted IdP signing certificate", () => {
    expect(() => normalizeSamlCertificate("not a certificate")).toThrow(/certificate/i);
    expect(normalizeSamlCertificate("-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----")).toContain("BEGIN CERTIFICATE");
  });

  it("handles invalid or dummy certificates gracefully when checking expiry", () => {
    expect(parseSamlCertificateExpiry("not a cert")).toBeNull();
    expect(parseSamlCertificateExpiry("-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----")).toBeNull();
  });
});
