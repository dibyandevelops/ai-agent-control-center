import { createHash } from "node:crypto";

export interface ComplianceCertificateInput {
  certificateId: string;
  issuedAt: string;
  standard: string;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  operator: {
    id: string;
    email: string;
    role: string;
  };
  timeWindow: {
    from: string | null;
    to: string | null;
  };
  chainIntegrity: {
    verified: boolean;
    eventsEvaluated: number;
    checkpointsEvaluated: number;
    rootHash: string | null;
    headHash: string | null;
    firstInvalidEventId: string | null;
  };
}

export interface ComplianceCertificate extends ComplianceCertificateInput {
  issuer: string;
  attestationDigest: string;
}

export interface ComplianceExportPackage {
  certificate: ComplianceCertificate;
  auditTrail: Array<{
    id: string;
    requestId: string | null;
    eventType: string;
    actorType: string;
    actorId: string;
    payload: Record<string, unknown>;
    previousHash: string | null;
    eventHash: string;
    createdAt: string;
  }>;
  approverDelegations: Array<{
    id: string;
    delegatorEmail?: string | null;
    delegateeEmail?: string | null;
    startsAt: string;
    endsAt: string;
    reason: string;
    active: boolean;
  }>;
  governanceRecords: Array<{
    id: string;
    actionRequestId: string;
    operation: "publish" | "cancel";
    status: string;
    requestedBy: string;
    reviewedBy: string | null;
    reviewReason: string | null;
    requestedAt: string;
    reviewedAt: string | null;
  }>;
  containmentIncidents: Array<{
    id: string;
    repository: string;
    tagName: string;
    severity: string;
    status: string;
    reason: string;
    containmentResource: string | null;
    detectedAt: string;
    resolvedAt: string | null;
  }>;
}

export function generateComplianceAttestationDigest(input: {
  certificateId: string;
  organizationId: string;
  issuedAt: string;
  standard: string;
  eventsEvaluated: number;
  rootHash: string | null;
  headHash: string | null;
  verified: boolean;
}): string {
  const canonical = JSON.stringify({
    certificateId: input.certificateId,
    organizationId: input.organizationId,
    issuedAt: input.issuedAt,
    standard: input.standard,
    eventsEvaluated: input.eventsEvaluated,
    rootHash: input.rootHash,
    headHash: input.headHash,
    verified: input.verified,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export function buildComplianceCertificate(
  input: ComplianceCertificateInput,
): ComplianceCertificate {
  const attestationDigest = generateComplianceAttestationDigest({
    certificateId: input.certificateId,
    organizationId: input.organization.id,
    issuedAt: input.issuedAt,
    standard: input.standard,
    eventsEvaluated: input.chainIntegrity.eventsEvaluated,
    rootHash: input.chainIntegrity.rootHash,
    headHash: input.chainIntegrity.headHash,
    verified: input.chainIntegrity.verified,
  });

  return {
    ...input,
    issuer: "SentinelOps Enterprise Control Plane (Cryptographic Attestation Authority)",
    attestationDigest: `sha256:${attestationDigest}`,
  };
}
