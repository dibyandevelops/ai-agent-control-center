import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { inviteOperator, listInvitations } from "@/lib/server/invitations";
import { operatorCan } from "@/lib/server/operator-roles";

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["admin", "approver", "auditor"]),
});

export async function GET() {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "read")) {
      return NextResponse.json({ error: "Read permission required." }, { status: 403 });
    }
    const invitations = await listInvitations(operator.organizationId);
    return NextResponse.json({ invitations });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "invite_members")) {
      return NextResponse.json({ error: "Admin role required to invite members." }, { status: 403 });
    }
    const input = inviteSchema.parse(await request.json());
    const invitation = await inviteOperator({
      organizationId: operator.organizationId,
      inviterId: operator.id,
      inviterEmail: operator.email,
      email: input.email,
      role: input.role,
    });
    return NextResponse.json({ invitation }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
