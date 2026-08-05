export type ReleaseGovernanceOperation = "publish" | "cancel";

export function canReviewReleaseGovernance(
  request: {
    requestedByOperatorId: string;
    requestedByEmail: string;
  },
  reviewer: { id: string; email: string },
) {
  return (
    request.requestedByOperatorId !== reviewer.id &&
    request.requestedByEmail !== reviewer.email
  );
}

export function releaseGovernanceLabel(operation: ReleaseGovernanceOperation) {
  return operation === "publish" ? "publication" : "cancellation";
}
