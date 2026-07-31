import { NextRequest, NextResponse } from "next/server";
import { reportExecutionOutcome } from "@/lib/server/action-service";
import { executionOutcomeSchema } from "@/lib/server/contracts";
import { apiError } from "@/lib/server/http";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId } = await context.params;
    const input = executionOutcomeSchema.parse(await request.json());
    const result = await reportExecutionOutcome(request, requestId, input);
    return NextResponse.json(result, {
      status: result.replayed ? 200 : 201,
    });
  } catch (error) {
    return apiError(error);
  }
}
