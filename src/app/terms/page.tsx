import { PublicDocument } from "@/components/public-document";

export default function TermsPage() {
  return <PublicDocument title="Pilot terms of service" updated="August 12, 2026" intro="These terms govern use of the SentinelOps pilot environment until replaced by a signed customer agreement." sections={[
    { title: "Pilot service", body: "SentinelOps provides governance controls for AI-agent actions. You remain responsible for the actions of your agents, repositories, credentials, and approved integrations." },
    { title: "Acceptable use", body: "Do not use the service to violate law, compromise systems, bypass access controls, or submit data you are not authorized to process." },
    { title: "Availability and changes", body: "The pilot may change and is provided without a production service-level agreement. Do not rely on the pilot as your sole safety control for critical operations." },
    { title: "Commercial terms", body: "Pilot limits apply unless SentinelOps confirms an enterprise plan in writing. Payment processing is not enabled in the pilot." },
  ]} />;
}
