import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canReviewReleaseGovernance,
  releaseGovernanceLabel,
} from "./release-governance";
import {
  releaseContainmentMessage,
  type ActiveReleaseContainment,
} from "./github-release-containment";
import {
  calculateAuditEventHash,
  verifyAuditChain,
  type AuditChainEvent,
  type AuditHashInput,
} from "./audit-chain";
import {
  buildComplianceCertificate,
} from "./compliance-export";
import {
  classifyGitHubReleaseMutation,
  verifyGitHubWebhookSignature,
} from "./github-release-webhook";

describe("Option 3 Compliance Drill: Four-Eyes Dual-Authorization", () => {
  const draftReleaseRequest = {
    requestedByOperatorId: "admin-iruka-001",
    requestedByEmail: "iruka@sentinelops-ai.com",
  };

  it("strictly prohibits maker self-approval (Dual-Control Four-Eyes Rule)", () => {
    const makerAttempt = canReviewReleaseGovernance(draftReleaseRequest, {
      id: "admin-iruka-001",
      email: "iruka@sentinelops-ai.com",
    });
    expect(makerAttempt).toBe(false);
  });

  it("authorizes distinct secondary administrator to approve release publication", () => {
    const secondaryApprover = {
      id: "admin-security-002",
      email: "security-officer@sentinelops-ai.com",
    };
    const authorizationAllowed = canReviewReleaseGovernance(
      draftReleaseRequest,
      secondaryApprover,
    );
    expect(authorizationAllowed).toBe(true);
  });

  it("labels release governance operations accurately", () => {
    expect(releaseGovernanceLabel("publish")).toBe("publication");
    expect(releaseGovernanceLabel("cancel")).toBe("cancellation");
  });
});

describe("Option 3 Compliance Drill: External Drift Containment Lock", () => {
  const incident: ActiveReleaseContainment = {
    id: "incident-gh-drift-9981",
    status: "open",
    reason: "Direct GitHub release edit detected outside SentinelOps control plane",
    detected_at: new Date(),
  };

  it("generates actionable containment freeze message on critical drift", () => {
    const message = releaseContainmentMessage(incident.id);
    expect(message).toContain("Release automation is frozen by critical GitHub incident");
    expect(message).toContain(incident.id);
    expect(message).toContain("Acknowledge and resolve");
  });

  it("classifies outside GitHub release webhook mutations as drift requiring containment", () => {
    const driftEvent = classifyGitHubReleaseMutation({
      action: "edited",
      draft: false,
      draftCreationStatus: "succeeded",
      publicationStatus: null,
      cancellationStatus: null,
    });
    expect(driftEvent.outcome).toBe("drift");
  });

  it("authenticates GitHub webhook HMAC signatures with constant-time verification", () => {
    const secret = "sentinelops-production-webhook-secret";
    const body = JSON.stringify({ action: "edited", repository: "sentinelops/platform" });
    const validSignature = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

    expect(
      verifyGitHubWebhookSignature({
        secret,
        body,
        signature: validSignature,
      }),
    ).toBe(true);

    expect(
      verifyGitHubWebhookSignature({
        secret,
        body,
        signature: "sha256=tampered_hex_signature_value_00000000000000000000000000000000",
      }),
    ).toBe(false);
  });
});

describe("Option 3 Compliance Drill: Cryptographic Chain & SOC 2 Evidence Export", () => {
  const event1Input: AuditHashInput = {
    requestId: "req-1",
    eventType: "action.evaluated",
    actorType: "agent",
    actorId: "agent-sales-01",
    payload: { action: "read_database", risk: "medium" },
  };
  const hash1 = calculateAuditEventHash(null, event1Input);

  const event2Input: AuditHashInput = {
    requestId: "req-1",
    eventType: "release.draft_publication_approved",
    actorType: "human",
    actorId: "security-officer@sentinelops-ai.com",
    payload: { governanceRequestId: "gov-1", reason: "Four-eyes review verified" },
  };
  const hash2 = calculateAuditEventHash(hash1, event2Input);

  const validChain: AuditChainEvent[] = [
    {
      id: "1",
      previousHash: null,
      eventHash: hash1,
      ...event1Input,
    },
    {
      id: "2",
      previousHash: hash1,
      eventHash: hash2,
      ...event2Input,
    },
  ];

  it("verifies intact SHA-256 tamper-evident hash chain", () => {
    const result = verifyAuditChain(validChain);
    expect(result.verified).toBe(true);
    expect(result.firstInvalidEventId).toBeNull();
  });

  it("detects tampering when an event payload is modified retroactively", () => {
    const tamperedChain: AuditChainEvent[] = [
      validChain[0],
      {
        ...validChain[1],
        payload: { governanceRequestId: "gov-1", reason: "TAMPERED PAYLOAD" },
      },
    ];
    const result = verifyAuditChain(tamperedChain);
    expect(result.verified).toBe(false);
    expect(result.firstInvalidEventId).toBe("2");
  });

  it("generates signed SOC 2 / ISO 27001 export certificate with valid attestation digest", () => {
    const cert = buildComplianceCertificate({
      certificateId: "cert-soc2-2026",
      issuedAt: new Date().toISOString(),
      standard: "SOC 2 Type II / ISO 27001 Annex A.12",
      organization: {
        id: "org-sentinelops-primary",
        name: "SentinelOps Core",
        slug: "sentinelops-core",
      },
      operator: {
        id: "admin-iruka",
        email: "iruka@sentinelops-ai.com",
        role: "admin",
      },
      timeWindow: { from: null, to: null },
      chainIntegrity: {
        verified: true,
        eventsEvaluated: validChain.length,
        checkpointsEvaluated: 0,
        rootHash: hash1,
        headHash: hash2,
        firstInvalidEventId: null,
      },
    });

    expect(cert.issuer).toContain("SentinelOps Enterprise Control Plane");
    expect(cert.attestationDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(cert.chainIntegrity.verified).toBe(true);
    expect(cert.chainIntegrity.eventsEvaluated).toBe(2);
  });
});
