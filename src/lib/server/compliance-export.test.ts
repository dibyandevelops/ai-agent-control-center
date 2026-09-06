import { describe, expect, it } from "vitest";
import {
  buildComplianceCertificate,
  generateComplianceAttestationDigest,
} from "./compliance-export";

describe("compliance-export certificate generator", () => {
  const sampleInput = {
    certificateId: "cert-uuid-12345",
    issuedAt: "2026-09-06T15:00:00.000Z",
    standard: "SOC 2 Type II / ISO 27001 Annex A.12",
    organization: {
      id: "org-uuid-99999",
      name: "Acme Corp",
      slug: "acme-corp",
    },
    operator: {
      id: "op-uuid-88888",
      email: "ciso@acme.com",
      role: "admin",
    },
    timeWindow: {
      from: null,
      to: null,
    },
    chainIntegrity: {
      verified: true,
      eventsEvaluated: 42,
      checkpointsEvaluated: 1,
      rootHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      headHash: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
      firstInvalidEventId: null,
    },
  };

  it("computes deterministic SHA-256 attestation digest", () => {
    const digest1 = generateComplianceAttestationDigest({
      certificateId: sampleInput.certificateId,
      organizationId: sampleInput.organization.id,
      issuedAt: sampleInput.issuedAt,
      standard: sampleInput.standard,
      eventsEvaluated: sampleInput.chainIntegrity.eventsEvaluated,
      rootHash: sampleInput.chainIntegrity.rootHash,
      headHash: sampleInput.chainIntegrity.headHash,
      verified: sampleInput.chainIntegrity.verified,
    });

    const digest2 = generateComplianceAttestationDigest({
      certificateId: sampleInput.certificateId,
      organizationId: sampleInput.organization.id,
      issuedAt: sampleInput.issuedAt,
      standard: sampleInput.standard,
      eventsEvaluated: sampleInput.chainIntegrity.eventsEvaluated,
      rootHash: sampleInput.chainIntegrity.rootHash,
      headHash: sampleInput.chainIntegrity.headHash,
      verified: sampleInput.chainIntegrity.verified,
    });

    expect(digest1).toHaveLength(64);
    expect(digest1).toBe(digest2);
  });

  it("detects tampered certificate digest when properties change", () => {
    const digestOriginal = generateComplianceAttestationDigest({
      certificateId: sampleInput.certificateId,
      organizationId: sampleInput.organization.id,
      issuedAt: sampleInput.issuedAt,
      standard: sampleInput.standard,
      eventsEvaluated: sampleInput.chainIntegrity.eventsEvaluated,
      rootHash: sampleInput.chainIntegrity.rootHash,
      headHash: sampleInput.chainIntegrity.headHash,
      verified: sampleInput.chainIntegrity.verified,
    });

    const digestTampered = generateComplianceAttestationDigest({
      certificateId: sampleInput.certificateId,
      organizationId: sampleInput.organization.id,
      issuedAt: sampleInput.issuedAt,
      standard: sampleInput.standard,
      eventsEvaluated: 43, // tampered count
      rootHash: sampleInput.chainIntegrity.rootHash,
      headHash: sampleInput.chainIntegrity.headHash,
      verified: sampleInput.chainIntegrity.verified,
    });

    expect(digestOriginal).not.toBe(digestTampered);
  });

  it("builds a complete signed certificate", () => {
    const cert = buildComplianceCertificate(sampleInput);

    expect(cert.certificateId).toBe(sampleInput.certificateId);
    expect(cert.issuer).toContain("SentinelOps Enterprise Control Plane");
    expect(cert.attestationDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(cert.chainIntegrity.verified).toBe(true);
    expect(cert.chainIntegrity.eventsEvaluated).toBe(42);
  });
});
