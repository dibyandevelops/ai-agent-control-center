import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { sendSlackConnectionTest } from "@/lib/server/slack";

export async function POST() {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "manage_integrations")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    const result = await sendSlackConnectionTest({
      organizationId: operator.organizationId,
      organizationName: operator.organizationName,
    });
    return NextResponse.json(result, { status: result.delivered ? 200 : 502 });
  } catch (error) {
    return apiError(error);
  }
}
