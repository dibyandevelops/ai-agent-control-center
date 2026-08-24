import { LandingPage } from "@/components/landing/landing-page";

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "SentinelOps",
    applicationCategory: "SecurityApplication",
    operatingSystem: "Cloud, Kubernetes, Docker, Linux, macOS, Windows",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "Zero-trust control plane and governance gateway for autonomous AI agents. Sub-20ms policy enforcement, multi-party human approval quorums, and tamper-evident audit logs.",
    url: "https://sentinelops.dev",
    featureList: [
      "Sub-20ms AI Gateway Policy Engine",
      "Human-in-the-loop Dual-Custody Approval Quorum",
      "Cryptographic Tamper-Evident SHA-256 Audit Chain",
      "Instant Emergency Agent Quarantine Killswitch",
      "Integrations with GitHub, Slack, AWS, and Python SDKs",
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
