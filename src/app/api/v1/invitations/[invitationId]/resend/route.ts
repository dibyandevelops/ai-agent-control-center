import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { resendInvitation } from "@/lib/server/invitations";
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
      return NextResponse.json({ error: "Admin role required to resend invitations." }, { status: 403 });
    }
    const { invitationId } = await context.params;
    const result = await resendInvitation({
      organizationId: operator.organizationId,
      invitationId,
      operatorId: operator.id,
      operatorEmail: operator.email,
    });
    return NextResponse.json({ resent: true, invitation: result });
  } catch (error) {
    return apiError(error);
  }
}
