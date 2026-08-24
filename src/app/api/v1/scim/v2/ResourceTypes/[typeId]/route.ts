import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/server/errors";
import { authenticateScimRequest } from "@/lib/server/identity-provisioning";
import { SCIM_RESOURCE_TYPES, SCIM_SCHEMAS } from "@/lib/server/scim-schema";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ typeId: string }> },
) {
  try {
    await authenticateScimRequest(request);
    const { typeId } = await context.params;

    const resourceType = SCIM_RESOURCE_TYPES.find(
      (t) => t.id.toLowerCase() === typeId.toLowerCase(),
    );

    if (!resourceType) {
      return NextResponse.json(
        {
          schemas: [SCIM_SCHEMAS.ERROR],
          status: "404",
          detail: `ResourceType '${typeId}' not found.`,
        },
        { status: 404, headers: { "content-type": "application/scim+json" } },
      );
    }

    return NextResponse.json(resourceType, {
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
