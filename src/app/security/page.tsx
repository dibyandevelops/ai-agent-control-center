import { PublicDocument } from "@/components/public-document";

export default function SecurityPage() {
  return <PublicDocument title="Security overview" updated="August 12, 2026" intro="SentinelOps is designed to provide accountable control over consequential AI-agent actions." sections={[
    { title: "Core controls", body: "Organizations are isolated in PostgreSQL. Operator sessions are revocable, roles are enforced server-side, sensitive actions can require MFA, and agent credentials are hashed and rotatable." },
    { title: "Governance evidence", body: "Policy decisions, approvals, release governance, and integration lifecycle events are appended to a tenant-scoped hash chain. GitHub draft creation and publication are independently governed." },
    { title: "Responsible disclosure", body: "Report suspected vulnerabilities to security@sentinelops.ai. Do not include secrets or exploit details in public issues. We will acknowledge reports and coordinate remediation." },
    { title: "Pilot limitations", body: "The pilot is not certified for SOC 2, ISO 27001, HIPAA, or PCI DSS. Customers should complete security review, data-processing terms, backup validation, and incident-response planning before production use." },
  ]} />;
}
