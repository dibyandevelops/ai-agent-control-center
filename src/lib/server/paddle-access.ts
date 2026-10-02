export function subscriptionGrantsPaidAccess(subscription: {
  status: string;
  scheduledChangeAction?: string | null;
}) {
  // A scheduled cancellation or pause does not change the current entitlement.
  return subscription.status === "active" || subscription.status === "trialing";
}
