import { NextRequest, NextResponse } from "next/server";
import { actionEvaluationSchema } from "@/lib/server/contracts";
import { evaluateAction } from "@/lib/server/action-service";
import { apiError } from "@/lib/server/http";

export async function POST(request: NextRequest) {
  try {
    const input = actionEvaluationSchema.parse(await request.json());
    const result = await evaluateAction(request, input);

    return NextResponse.json(result, {
      status: result.replayed ? 200 : 201,
    });
  } catch (error) {
    return apiError(error);
  }
}
