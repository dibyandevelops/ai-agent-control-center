import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { liftAgentQuarantine } from "@/lib/server/agent-quarantine";

const schema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ agentId: string }> },
) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }

    const { agentId } = await context.params;
    const body = await request.json();
    const input = schema.parse(body);

    const result = await liftAgentQuarantine(
      operator.organizationId,
      agentId,
      operator,
      input.reason,
    );

    return NextResponse.json({ agent: result });
  } catch (error) {
    return apiError(error);
  }
}
