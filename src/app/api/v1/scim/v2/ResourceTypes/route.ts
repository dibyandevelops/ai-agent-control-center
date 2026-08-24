import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/server/errors";
import { authenticateScimRequest } from "@/lib/server/identity-provisioning";
import { SCIM_RESOURCE_TYPES, SCIM_SCHEMAS } from "@/lib/server/scim-schema";

export async function GET(request: NextRequest) {
  try {
    await authenticateScimRequest(request);
    return NextResponse.json(
      {
        schemas: [SCIM_SCHEMAS.LIST_RESPONSE],
        totalResults: SCIM_RESOURCE_TYPES.length,
        startIndex: 1,
        itemsPerPage: SCIM_RESOURCE_TYPES.length,
        Resources: SCIM_RESOURCE_TYPES,
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
