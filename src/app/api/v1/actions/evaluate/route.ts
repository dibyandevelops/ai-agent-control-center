import { after, NextRequest, NextResponse } from "next/server";
import { actionEvaluationSchema } from "@/lib/server/contracts";
import { evaluateAction } from "@/lib/server/action-service";
import { apiError } from "@/lib/server/http";
import { notifySlackOfApproval } from "@/lib/server/slack";

export async function POST(request: NextRequest) {
  try {
    const input = actionEvaluationSchema.parse(await request.json());
    const result = await evaluateAction(request, input);

    if (result.status === "pending" && !result.replayed) {
      after(async () => {
        await notifySlackOfApproval({
          requestId: result.requestId,
          agentName: input.agent.name,
          action: input.action,
          resource: input.resource,
          risk: result.risk,
        }).catch((error) => {
          console.error("Slack approval notification failed", error);
        });
      });
    }

    return NextResponse.json(result, {
      status: result.replayed ? 200 : 201,
    });
  } catch (error) {
    return apiError(error);
  }
}
