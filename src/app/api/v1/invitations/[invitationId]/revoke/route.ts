import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { revokeInvitation } from "@/lib/server/invitations";
import { operatorCan } from "@/lib/server/operator-roles";

export async function POST(
  _request: Request,
  context: { params: Promise<{ invitationId: string }> },
) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "invite_members")) {
      return NextResponse.json({ error: "Admin role required to revoke invitations." }, { status: 403 });
    }
    const { invitationId } = await context.params;
    const result = await revokeInvitation({
      organizationId: operator.organizationId,
      invitationId,
      operatorId: operator.id,
      operatorEmail: operator.email,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
