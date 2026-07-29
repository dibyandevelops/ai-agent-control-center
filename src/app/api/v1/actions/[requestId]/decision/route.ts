import { NextRequest, NextResponse } from "next/server";
import { decideAction } from "@/lib/server/action-service";
import { hasAdminSession } from "@/lib/server/auth";
import { decisionSchema } from "@/lib/server/contracts";
import { apiError } from "@/lib/server/http";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> },
) {
  try {
    if (!(await hasAdminSession(request))) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }
    const { requestId } = await context.params;
    const input = decisionSchema.parse(await request.json());
    const result = await decideAction(requestId, input);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
