import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession, requireRecentMfa } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { configureSaml, disableSaml } from "@/lib/server/saml-sso";
import { operatorCan } from "@/lib/server/operator-roles";

const schema = z.object({
  idpEntityId: z.string().url(),
  entryPoint: z.string().url(),
  idpCertificate: z.string().min(40).max(30_000),
  emailAttribute: z.string().trim().min(1).max(255).default("email"),
  enabled: z.boolean().default(false),
  enforced: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    if (!operatorCan(operator.role, "manage_identity")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    await requireRecentMfa(operator);
    const input = schema.parse(await request.json());
    const result = await configureSaml({
      organizationId: operator.organizationId,
      operatorId: operator.id,
      operatorEmail: operator.email,
      ...input,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE() {
  try {
    const operator = await getOperatorSession();
    if (!operator) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    if (!operatorCan(operator.role, "manage_identity")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    await requireRecentMfa(operator);
    const result = await disableSaml({
      organizationId: operator.organizationId,
      operatorId: operator.id,
      operatorEmail: operator.email,
    });
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
