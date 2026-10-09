import { PublicDocument } from "@/components/public-document";

export default function RefundPolicyPage() {
  return <PublicDocument title="Refund & cancellation policy" updated="October 9, 2026" intro="SentinelOps currently offers its Pilot workspace at no charge and is not accepting new paid subscriptions. This policy explains how to get help with an existing subscription or billing issue." sections={[
    { title: "Free pilot", body: "There is no charge, recurring payment, or refund for the free Pilot workspace. Creating a Pilot workspace does not enroll you in a paid plan." },
    { title: "Existing subscriptions and cancellation", body: "If you have an existing paid subscription, its purchase terms and cancellation conditions continue to apply. Use the billing portal linked in your account where available, or contact cs@sentinelops-ai.com if you need help accessing it. Applicable consumer rights are not limited by this policy." },
    { title: "Refund requests and billing issues", body: "For a charge relating to an existing subscription, contact cs@sentinelops-ai.com with the checkout email, transaction date, and receipt or transaction reference. Do not send full payment-card details by email. Where Paddle processed the transaction, we can direct you to its buyer support and refund process. This policy does not limit non-waivable statutory rights." },
  ]} />;
}
