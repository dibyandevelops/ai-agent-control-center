import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import {
  getOrganizationIdentitySettings,
  updateAllowedEmailDomains,
} from "@/lib/server/identity-provisioning";
import { operatorCan } from "@/lib/server/operator-roles";

const updateSchema = z.object({
  allowedEmailDomains: z.array(z.string().min(3).max(253)).max(25),
});

async function requireAdmin() {
  const operator = await getOperatorSession();
  if (!operator) return { operator: null, response: NextResponse.json({ error: "Operator authentication required." }, { status: 401 }) };
  if (!operatorCan(operator.role, "manage_operators")) {
    return { operator: null, response: NextResponse.json({ error: "Admin role required." }, { status: 403 }) };
  }
  return { operator, response: null };
}

export async function GET() {
  try {
    const authorization = await requireAdmin();
    if (!authorization.operator) return authorization.response;
    return NextResponse.json(await getOrganizationIdentitySettings(authorization.operator.organizationId));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.operator) return authorization.response;
    const input = updateSchema.parse(await request.json());
    return NextResponse.json(await updateAllowedEmailDomains({
      organizationId: authorization.operator.organizationId,
      operatorId: authorization.operator.id,
      operatorEmail: authorization.operator.email,
      domains: input.allowedEmailDomains,
    }));
  } catch (error) {
    return apiError(error);
  }
}
