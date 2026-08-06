import { NextRequest, NextResponse } from "next/server";
import { AuthenticationError } from "@/lib/server/errors";
import { authenticateScimRequest } from "@/lib/server/identity-provisioning";

const schema = "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig";
const errorSchema = "urn:ietf:params:scim:api:messages:2.0:Error";

export async function GET(request: NextRequest) {
  try {
    await authenticateScimRequest(request);
    return NextResponse.json({
      schemas: [schema],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 100 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [{ type: "oauthbearertoken", name: "Bearer Token", description: "Tenant-scoped SentinelOps SCIM token", primary: true }],
    }, { headers: { "content-type": "application/scim+json" } });
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : 400;
    return NextResponse.json({ schemas: [errorSchema], status: String(status), detail: error instanceof Error ? error.message : "Invalid SCIM request." }, { status, headers: { "content-type": "application/scim+json" } });
  }
}
