import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession, requireRecentMfa } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { configureSaml, disableSaml } from "@/lib/server/saml-sso";
import { operatorCan } from "@/lib/server/operator-roles";

import { parseSamlIdpMetadataXml } from "@/lib/server/saml-core";

const schema = z
  .object({
    metadataXml: z.string().trim().min(20).optional(),
    idpEntityId: z.string().url().optional(),
    entryPoint: z.string().url().optional(),
    idpCertificate: z.string().min(40).max(30_000).optional(),
    emailAttribute: z.string().trim().min(1).max(255).default("email"),
    enabled: z.boolean().default(false),
    enforced: z.boolean().optional(),
  })
  .refine(
    (data) =>
      Boolean(data.metadataXml) ||
      (Boolean(data.idpEntityId) &&
        Boolean(data.entryPoint) &&
        Boolean(data.idpCertificate)),
    {
      message:
        "Either metadataXml or (idpEntityId, entryPoint, idpCertificate) must be provided.",
    },
  );

export async function PATCH(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    if (!operatorCan(operator.role, "manage_identity")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    await requireRecentMfa(operator);
    const input = schema.parse(await request.json());

    let idpEntityId = input.idpEntityId ?? "";
    let entryPoint = input.entryPoint ?? "";
    let idpCertificate = input.idpCertificate ?? "";

    if (input.metadataXml) {
      const parsed = parseSamlIdpMetadataXml(input.metadataXml);
      idpEntityId = parsed.entityId;
      entryPoint = parsed.entryPoint;
      idpCertificate = parsed.certificate;
    }

    const result = await configureSaml({
      organizationId: operator.organizationId,
      operatorId: operator.id,
      operatorEmail: operator.email,
      idpEntityId,
      entryPoint,
      idpCertificate,
      emailAttribute: input.emailAttribute,
      enabled: input.enabled,
      enforced: input.enforced,
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
