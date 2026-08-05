import { after, NextRequest, NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { requeueFailedReleaseGovernance } from "@/lib/server/release-governance-retry";
import { runApprovedDraftGovernanceWorker } from "@/lib/server/release-governance-worker";

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ governanceId: string }> },
) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }
    if (!operatorCan(operator.role, "retry_execution")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    const { governanceId } = await context.params;
    const result = await requeueFailedReleaseGovernance({
      governanceId,
      organizationId: operator.organizationId,
      operatorEmail: operator.email,
    });
    after(async () => {
      try {
        await runApprovedDraftGovernanceWorker({ governanceId, limit: 1 });
      } catch (error) {
        console.error("Retried GitHub draft operation failed to start", error);
      }
    });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (
      error && typeof error === "object" && "code" in error &&
      error.code === "23505"
    ) {
      return NextResponse.json(
        { error: "A newer release governance operation is already active." },
        { status: 409 },
      );
    }
    return apiError(error);
  }
}
