import { describe, expect, it } from "vitest";
import {
  createSamlRelayState,
  formatX509Pem,
  hashSamlRelayState,
  normalizeSamlCertificate,
  parseSamlCertificateExpiry,
  parseSamlIdpMetadataXml,
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

  it("formats base64 certificate data into standard PEM chunks", () => {
    const raw = "MIIDqjCCApKgAwIBAgIGAYz4a56JMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzET";
    const pem = formatX509Pem(raw);
    expect(pem).toContain("-----BEGIN CERTIFICATE-----");
    expect(pem).toContain("-----END CERTIFICATE-----");
    expect(pem.replace(/\s+/g, "")).toContain(raw);
  });

  it("parses SAML IdP metadata XML from Okta / Microsoft Entra ID", () => {
    const oktaXml = `
      <md:EntityDescriptor entityID="http://www.okta.com/exk123456789" xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata">
        <md:IDPSSODescriptor WantAuthnRequestsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
          <md:KeyDescriptor use="signing">
            <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
              <ds:X509Data>
                <ds:X509Certificate>MIIDqjCCApKgAwIBAgIGAYz4a56JMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzET</ds:X509Certificate>
              </ds:X509Data>
            </ds:KeyInfo>
          </md:KeyDescriptor>
          <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://dev-123456.okta.com/app/sentinelops/exk123456789/sso/saml"/>
          <md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://dev-123456.okta.com/app/sentinelops/exk123456789/sso/saml/post"/>
        </md:IDPSSODescriptor>
      </md:EntityDescriptor>
    `;

    const parsed = parseSamlIdpMetadataXml(oktaXml);
    expect(parsed.entityId).toBe("http://www.okta.com/exk123456789");
    expect(parsed.entryPoint).toBe("https://dev-123456.okta.com/app/sentinelops/exk123456789/sso/saml");
    expect(parsed.certificate).toContain("-----BEGIN CERTIFICATE-----");
    expect(parsed.certificate.replace(/\s+/g, "")).toContain("MIIDqjCCApKgAwIBAgIGAYz4a56JMA0GCSqGSIb3DQEBCwUAMIGQMQswCQYDVQQGEwJVUzET");
  });

  it("rejects invalid XML missing essential SAML metadata elements", () => {
    expect(() => parseSamlIdpMetadataXml("<root></root>")).toThrow(/Invalid SAML metadata/);
    expect(() => parseSamlIdpMetadataXml("<EntityDescriptor></EntityDescriptor>")).toThrow(/entityID/);
  });
});
