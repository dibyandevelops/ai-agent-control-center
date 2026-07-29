import { NextRequest, NextResponse } from "next/server";
import { getActionForAgent } from "@/lib/server/action-service";
import { apiError } from "@/lib/server/http";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    const { requestId } = await context.params;
    const result = await getActionForAgent(request, requestId);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
