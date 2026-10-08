import { PublicDocument } from "@/components/public-document";

export default function RefundPolicyPage() {
  return <PublicDocument title="Refund & cancellation policy" updated="October 6, 2026" intro="SentinelOps subscriptions are sold through Paddle, our merchant of record. Paddle presents the final price, currency, applicable taxes, and trial terms during checkout." sections={[
    { title: "Canceling a subscription", body: "You can request cancellation from the billing portal linked in your SentinelOps account, or contact cs@sentinelops-ai.com if you cannot access it. Unless checkout or mandatory local law says otherwise, cancellation stops the next renewal and takes effect at the end of the current paid billing period. You can continue using paid features until that period ends. A free trial converts to a paid subscription at its end if it is not canceled before then." },
    { title: "Refund requests", body: "Refund eligibility is handled under Paddle's current buyer refund policy (https://www.paddle.com/legal/refund-policy) and any mandatory consumer rights that apply to you. To request help, use Paddle's buyer support channel at https://paddle.net or email cs@sentinelops-ai.com with the checkout email and transaction reference. Please do not send full payment-card details by email. Paddle may need to verify the purchase and may process approved refunds to the original payment method." },
    { title: "Questions or billing problems", body: "For duplicate charges, a charge you do not recognize, or trouble canceling, contact cs@sentinelops-ai.com and include the transaction date and receipt or transaction ID. We will help route billing requests to Paddle where needed. This policy does not limit non-waivable statutory rights." },
  ]} />;
}
