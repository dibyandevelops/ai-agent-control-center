import { NextResponse } from "next/server";
import { getOperatorSession, requireRecentMfa } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { rotateOrganizationScimToken } from "@/lib/server/identity-provisioning";
import { operatorCan } from "@/lib/server/operator-roles";

export async function POST() {
  try {
    const operator = await getOperatorSession();
    if (!operator) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    if (!operatorCan(operator.role, "manage_operators")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    await requireRecentMfa(operator);
    const token = await rotateOrganizationScimToken({
      organizationId: operator.organizationId,
      operatorId: operator.id,
      operatorEmail: operator.email,
    });
    return NextResponse.json({ token }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
