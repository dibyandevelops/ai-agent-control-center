import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { listOrganizationGitHubConnections } from "@/lib/server/github-connections";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";

async function authorize() {
  const operator = await getOperatorSession();
  if (!operator) return { response: NextResponse.json({ error: "Operator authentication required." }, { status: 401 }) };
  if (!operatorCan(operator.role, "govern_releases")) {
    return { response: NextResponse.json({ error: "Admin role required." }, { status: 403 }) };
  }
  return { operator };
}

export async function GET() {
  try {
    const authorization = await authorize();
    if (!authorization.operator) return authorization.response;
    const connections = await listOrganizationGitHubConnections(
      authorization.operator.organizationId,
    );
    return NextResponse.json({ connections });
  } catch (error) {
    return apiError(error);
  }
}
