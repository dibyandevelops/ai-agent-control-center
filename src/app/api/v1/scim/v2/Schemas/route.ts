import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/server/errors";
import { authenticateScimRequest } from "@/lib/server/identity-provisioning";
import { SCIM_SCHEMA_DEFINITIONS, SCIM_SCHEMAS } from "@/lib/server/scim-schema";

export async function GET(request: NextRequest) {
  try {
    await authenticateScimRequest(request);
    return NextResponse.json(
      {
        schemas: [SCIM_SCHEMAS.LIST_RESPONSE],
        totalResults: SCIM_SCHEMA_DEFINITIONS.length,
        startIndex: 1,
        itemsPerPage: SCIM_SCHEMA_DEFINITIONS.length,
        Resources: SCIM_SCHEMA_DEFINITIONS,
      },
      { headers: { "content-type": "application/scim+json" } },
    );
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
