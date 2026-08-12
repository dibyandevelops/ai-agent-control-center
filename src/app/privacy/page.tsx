import { PublicDocument } from "@/components/public-document";

export default function PrivacyPage() {
  return <PublicDocument title="Privacy notice" updated="August 12, 2026" intro="This pilot notice explains how SentinelOps handles workspace, operator, and governance data while operating the service." sections={[
    { title: "Data we process", body: "We process organization details, operator account information, agent metadata, policy configuration, approval decisions, integration identifiers, and audit evidence required to provide SentinelOps." },
    { title: "How we use it", body: "We use this data to enforce your policies, authenticate users, deliver notifications, investigate security events, and operate the service. We do not sell customer data." },
    { title: "Retention and security", body: "Pilot workspaces retain audit evidence for 90 days by default. Enterprise retention is configured by agreement. Access is tenant-scoped, and audit evidence is hash chained to make tampering evident." },
    { title: "Your choices", body: "Contact SentinelOps to request access, correction, export, or deletion subject to legal, security, and contractual obligations. A signed data-processing agreement is required before handling regulated production data." },
  ]} />;
}
