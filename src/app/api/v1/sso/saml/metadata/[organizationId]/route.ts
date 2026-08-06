import { NextResponse } from "next/server";
import { apiError } from "@/lib/server/http";
import { samlMetadata } from "@/lib/server/saml-sso";

export async function GET(_request: Request, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const { organizationId } = await context.params;
    const metadata = await samlMetadata(organizationId);
    return new NextResponse(metadata, { headers: { "content-type": "application/samlmetadata+xml", "cache-control": "no-store" } });
  } catch (error) { return apiError(error); }
}
