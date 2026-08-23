import { NextResponse } from "next/server";
import { getOperatorSession, requireRecentMfa } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { testOrganizationHttpsWebhook } from "@/lib/server/https-webhooks";

export async function POST(
  _request: Request,
  context: { params: Promise<{ webhookId: string }> },
) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "manage_integrations")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    await requireRecentMfa(operator);
    const { webhookId } = await context.params;
    const result = await testOrganizationHttpsWebhook({
      organizationId: operator.organizationId,
      operatorEmail: operator.email,
      webhookId,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
