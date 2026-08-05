import { after, NextRequest, NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { requeueFailedReleaseExecution } from "@/lib/server/release-execution-retry";
import { runApprovedReleaseWorker } from "@/lib/server/release-execution-worker";

export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
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
      return NextResponse.json(
        { error: "Admin role required." },
        { status: 403 },
      );
    }
    const { requestId } = await context.params;
    const result = await requeueFailedReleaseExecution({
      requestId,
      organizationId: operator.organizationId,
      operatorEmail: operator.email,
    });
    after(async () => {
      try {
        await runApprovedReleaseWorker({ requestId, limit: 1 });
      } catch (error) {
        console.error("Retried release execution failed to start", error);
      }
    });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
