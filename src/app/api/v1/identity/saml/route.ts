import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession, requireRecentMfa } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { configureSaml } from "@/lib/server/saml-sso";
import { operatorCan } from "@/lib/server/operator-roles";

const schema = z.object({ idpEntityId: z.string().url(), entryPoint: z.string().url(), idpCertificate: z.string().min(40).max(30_000), emailAttribute: z.string().trim().min(1).max(255).default("email"), enabled: z.boolean().default(false) });

export async function PATCH(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    if (!operatorCan(operator.role, "manage_operators")) return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    await requireRecentMfa(operator);
    const input = schema.parse(await request.json());
    await configureSaml({ organizationId: operator.organizationId, operatorId: operator.id, operatorEmail: operator.email, ...input });
    return NextResponse.json({ configured: true, enabled: input.enabled });
  } catch (error) { return apiError(error); }
}
