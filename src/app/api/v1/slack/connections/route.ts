import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { disconnectSlackConnection } from "@/lib/server/slack-connections";

export async function DELETE() {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "manage_integrations")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    const disconnected = await disconnectSlackConnection({
      organizationId: operator.organizationId,
      operatorEmail: operator.email,
    });
    return NextResponse.json({ disconnected });
  } catch (error) {
    return apiError(error);
  }
}
