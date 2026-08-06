import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError, ConflictError, NotFoundError } from "@/lib/server/errors";
import { authenticateScimRequest, getScimUser, provisionScimUser } from "@/lib/server/identity-provisioning";

const coreSchema = "urn:ietf:params:scim:schemas:core:2.0:User";
const errorSchema = "urn:ietf:params:scim:api:messages:2.0:Error";
const extensionSchema = "urn:sentinelops:schemas:extension:identity:2.0:User";

const patchSchema = z.object({
  schemas: z.array(z.string()).optional(),
  Operations: z.array(z.object({
    op: z.enum(["replace", "add"]),
    path: z.string().optional(),
    value: z.unknown(),
  })).min(1).max(20),
});

function asScimUser(user: { id: string; externalId: string | null; userName: string; displayName: string; role: string; active: boolean }, baseUrl: string) {
  return {
    schemas: [coreSchema, extensionSchema], id: user.id, externalId: user.externalId,
    userName: user.userName, displayName: user.displayName, active: user.active,
    [extensionSchema]: { role: user.role },
    meta: { resourceType: "User", location: `${baseUrl}/api/v1/scim/v2/Users/${user.id}` },
  };
}

function scimError(error: unknown) {
  const status = error instanceof AuthenticationError ? 401 : error instanceof NotFoundError ? 404 : error instanceof ConflictError ? 409 : 400;
  return NextResponse.json({ schemas: [errorSchema], status: String(status), detail: error instanceof Error ? error.message : "Invalid SCIM request." }, { status, headers: { "content-type": "application/scim+json" } });
}

export async function GET(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const [identity, { userId }] = await Promise.all([authenticateScimRequest(request), context.params]);
    const user = await getScimUser(identity.organizationId, userId);
    return NextResponse.json(asScimUser(user, request.nextUrl.origin), { headers: { "content-type": "application/scim+json" } });
  } catch (error) {
    return scimError(error);
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    const [identity, { userId }, input] = await Promise.all([
      authenticateScimRequest(request), context.params, request.json().then((body) => patchSchema.parse(body)),
    ]);
    const current = await getScimUser(identity.organizationId, userId);
    let email = current.userName;
    let displayName = current.displayName;
    let role = current.role;
    let active = current.active;
    for (const operation of input.Operations) {
      const path = operation.path?.toLowerCase();
      if (path === "active") active = z.boolean().parse(operation.value);
      else if (path === "username") email = z.string().email().parse(operation.value).trim().toLowerCase();
      else if (path === "displayname") displayName = z.string().min(2).max(120).parse(operation.value).trim();
      else if (path === `${extensionSchema.toLowerCase()}:role`) role = z.enum(["admin", "approver", "auditor"]).parse(operation.value);
      else if (!path && typeof operation.value === "object" && operation.value) {
        const value = operation.value as Record<string, unknown>;
        if ("active" in value) active = z.boolean().parse(value.active);
        if ("userName" in value) email = z.string().email().parse(value.userName).trim().toLowerCase();
        if ("displayName" in value) displayName = z.string().min(2).max(120).parse(value.displayName).trim();
        const extension = value[extensionSchema];
        if (typeof extension === "object" && extension && "role" in extension) role = z.enum(["admin", "approver", "auditor"]).parse((extension as { role: unknown }).role);
      } else {
        throw new Error(`Unsupported SCIM patch path: ${operation.path ?? "(none)"}`);
      }
    }
    const user = await provisionScimUser({ organizationId: identity.organizationId, externalId: current.externalId, email, displayName, role, active });
    return NextResponse.json(asScimUser(user, request.nextUrl.origin), { headers: { "content-type": "application/scim+json" } });
  } catch (error) {
    return scimError(error);
  }
}
