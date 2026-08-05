import { after, NextRequest, NextResponse } from "next/server";
import { decideAction } from "@/lib/server/action-service";
import { getOperatorSession } from "@/lib/server/auth";
import { operatorCan } from "@/lib/server/operator-roles";
import { decisionSchema } from "@/lib/server/contracts";
import { apiError } from "@/lib/server/http";
import { runApprovedReleaseWorker } from "@/lib/server/release-execution-worker";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
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
    if (!operatorCan(operator.role, "approve")) {
      return NextResponse.json(
        { error: "Approver role required." },
        { status: 403 },
      );
    }
    const { requestId } = await context.params;
    const input = decisionSchema.parse(await request.json());
    const result = await decideAction(requestId, input, operator);
    if (result.status === "approved") {
      after(async () => {
        try {
          await runApprovedReleaseWorker({ requestId, limit: 1 });
        } catch (error) {
          console.error("Automated release execution failed to start", error);
        }
      });
    }
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
