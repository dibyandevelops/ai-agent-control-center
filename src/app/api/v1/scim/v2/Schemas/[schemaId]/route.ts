import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/server/errors";
import { authenticateScimRequest } from "@/lib/server/identity-provisioning";
import { SCIM_SCHEMA_DEFINITIONS, SCIM_SCHEMAS } from "@/lib/server/scim-schema";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ schemaId: string }> },
) {
  try {
    await authenticateScimRequest(request);
    const { schemaId } = await context.params;
    const decodedSchemaId = decodeURIComponent(schemaId);

    const schemaDef = SCIM_SCHEMA_DEFINITIONS.find(
      (s) => s.id === decodedSchemaId || s.name.toLowerCase() === decodedSchemaId.toLowerCase(),
    );

    if (!schemaDef) {
      return NextResponse.json(
        {
          schemas: [SCIM_SCHEMAS.ERROR],
          status: "404",
          detail: `Schema '${decodedSchemaId}' not found.`,
        },
        { status: 404, headers: { "content-type": "application/scim+json" } },
      );
    }

    return NextResponse.json(schemaDef, {
      headers: { "content-type": "application/scim+json" },
    });
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : 400;
    return NextResponse.json(
      {
        schemas: [SCIM_SCHEMAS.ERROR],
        status: String(status),
        detail: error instanceof Error ? error.message : "Invalid SCIM request.",
      },
      { status, headers: { "content-type": "application/scim+json" } },
    );
  }
}
