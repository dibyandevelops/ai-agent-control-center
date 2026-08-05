import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { sendSlackConnectionTest } from "@/lib/server/slack";

const testSchema = z.object({ connectionId: z.string().uuid() });

export async function POST(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "manage_integrations")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    const input = testSchema.parse(await request.json());
    const result = await sendSlackConnectionTest({
      organizationId: operator.organizationId,
      organizationName: operator.organizationName,
      connectionId: input.connectionId,
    });
    return NextResponse.json(result, { status: result.delivered ? 200 : 502 });
  } catch (error) {
    return apiError(error);
  }
}
