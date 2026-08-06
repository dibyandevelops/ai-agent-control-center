import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError, ConflictError } from "@/lib/server/errors";
import { getPool } from "@/lib/server/db";
import {
  authenticateScimRequest,
  provisionScimUser,
} from "@/lib/server/identity-provisioning";

const coreSchema = "urn:ietf:params:scim:schemas:core:2.0:User";
const listSchema = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const errorSchema = "urn:ietf:params:scim:api:messages:2.0:Error";
const extensionSchema = "urn:sentinelops:schemas:extension:identity:2.0:User";

const scimUserSchema = z.object({
  schemas: z.array(z.string()).optional(),
  externalId: z.string().trim().min(1).max(255).nullable().optional(),
  userName: z.string().email().transform((value) => value.trim().toLowerCase()),
  name: z.object({
    formatted: z.string().trim().min(2).max(120).optional(),
    givenName: z.string().trim().min(1).max(80).optional(),
    familyName: z.string().trim().min(1).max(80).optional(),
  }).optional(),
  displayName: z.string().trim().min(2).max(120).optional(),
  active: z.boolean().default(true),
  [extensionSchema]: z.object({ role: z.enum(["admin", "approver", "auditor"]).default("approver") }).optional(),
});

function displayName(input: z.infer<typeof scimUserSchema>) {
  return input.displayName || input.name?.formatted || [input.name?.givenName, input.name?.familyName].filter(Boolean).join(" ") || input.userName;
}

function asScimUser(user: { id: string; externalId: string | null; userName: string; displayName: string; role: string; active: boolean }, baseUrl: string) {
  return {
    schemas: [coreSchema, extensionSchema],
    id: user.id,
    externalId: user.externalId,
    userName: user.userName,
    displayName: user.displayName,
    active: user.active,
    [extensionSchema]: { role: user.role },
    meta: { resourceType: "User", location: `${baseUrl}/api/v1/scim/v2/Users/${user.id}` },
  };
}

function scimError(error: unknown) {
  const status = error instanceof AuthenticationError ? 401 : error instanceof ConflictError ? 409 : 400;
  const detail = error instanceof Error ? error.message : "Invalid SCIM request.";
  return NextResponse.json({ schemas: [errorSchema], status: String(status), detail }, { status, headers: { "content-type": "application/scim+json" } });
}

export async function GET(request: NextRequest) {
  try {
    const identity = await authenticateScimRequest(request);
    const filter = request.nextUrl.searchParams.get("filter");
    const emailMatch = filter?.match(/^userName\s+eq\s+"([^"]+)"$/i);
    const result = await getPool().query<{
      id: string; external_identity_id: string | null; email: string; display_name: string;
      role: string; status: "active" | "disabled";
    }>(
      `select id, external_identity_id, email, display_name, role, status
         from operators
        where organization_id = $1 and identity_source = 'scim'
          and ($2::text is null or email = lower($2))
        order by created_at asc
        limit 100`,
      [identity.organizationId, emailMatch?.[1] ?? null],
    );
    const resources = result.rows.map((row) => asScimUser({ id: row.id, externalId: row.external_identity_id, userName: row.email, displayName: row.display_name, role: row.role, active: row.status === "active" }, request.nextUrl.origin));
    return NextResponse.json({ schemas: [listSchema], totalResults: resources.length, startIndex: 1, itemsPerPage: resources.length, Resources: resources }, { headers: { "content-type": "application/scim+json" } });
  } catch (error) {
    return scimError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const identity = await authenticateScimRequest(request);
    const input = scimUserSchema.parse(await request.json());
    const user = await provisionScimUser({
      organizationId: identity.organizationId,
      externalId: input.externalId ?? null,
      email: input.userName,
      displayName: displayName(input),
      role: input[extensionSchema]?.role ?? "approver",
      active: input.active,
    });
    return NextResponse.json(asScimUser(user, request.nextUrl.origin), { status: user.created ? 201 : 200, headers: { "content-type": "application/scim+json" } });
  } catch (error) {
    return scimError(error);
  }
}
