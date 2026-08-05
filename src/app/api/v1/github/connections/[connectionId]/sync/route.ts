import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { syncGitHubInstallation } from "@/lib/server/github-connections";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";

export async function POST(
  _request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "govern_releases")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    const { connectionId } = await context.params;
    const connections = await syncGitHubInstallation({
      organizationId: operator.organizationId,
      operatorId: operator.id,
      operatorEmail: operator.email,
      connectionId,
    });
    return NextResponse.json({ connections });
  } catch (error) {
    return apiError(error);
  }
}
