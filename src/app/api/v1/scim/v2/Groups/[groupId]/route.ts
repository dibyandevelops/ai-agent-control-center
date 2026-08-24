import { NextRequest, NextResponse } from "next/server";
import { getPool, withTransaction } from "@/lib/server/db";
import { AuthenticationError } from "@/lib/server/errors";
import { authenticateScimRequest } from "@/lib/server/identity-provisioning";
import { appendAuditEvent } from "@/lib/server/audit";
import {
  resolveRoleFromGroupName,
  roleToDefaultGroupId,
  roleToDefaultGroupName,
  SCIM_SCHEMAS,
  ScimGroupMember,
  ScimGroupResource,
} from "@/lib/server/scim-schema";
import { OperatorRole } from "@/lib/server/operator-roles";

function parseRoleFromGroupId(groupId: string): OperatorRole {
  const normalized = groupId.toLowerCase();
  if (normalized.includes("admin")) return "admin";
  if (normalized.includes("auditor") || normalized.includes("audit")) return "auditor";
  return "approver";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const auth = await authenticateScimRequest(request);
    const { groupId } = await context.params;
    const role = parseRoleFromGroupId(groupId);
    const pool = getPool();

    const result = await pool.query<{ id: string; display_name: string }>(
      `select id, display_name
         from operators
        where organization_id = $1 and role = $2 and status = 'active'
        order by display_name asc`,
      [auth.organizationId, role],
    );

    const canonicalGroupId = roleToDefaultGroupId(role);
    const members: ScimGroupMember[] = result.rows.map((r) => ({
      value: r.id,
      display: r.display_name,
      $ref: `/Users/${r.id}`,
      type: "User",
    }));

    const groupResource: ScimGroupResource = {
      schemas: [SCIM_SCHEMAS.GROUP],
      id: canonicalGroupId,
      displayName: roleToDefaultGroupName(role),
      members,
      meta: {
        resourceType: "Group",
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        location: `/Groups/${canonicalGroupId}`,
      },
    };

    return NextResponse.json(groupResource, {
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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const auth = await authenticateScimRequest(request);
    const { groupId } = await context.params;
    const body = (await request.json()) as {
      schemas?: string[];
      Operations?: Array<{
        op: "add" | "remove" | "replace";
        path?: string;
        value?: Array<{ value: string }> | { value: string };
      }>;
      members?: Array<{ value: string }>;
      displayName?: string;
    };

    const targetRole = body.displayName
      ? resolveRoleFromGroupName(body.displayName) || parseRoleFromGroupId(groupId)
      : parseRoleFromGroupId(groupId);

    // Extract added and removed member IDs from SCIM Patch Operations
    const addedMemberIds: string[] = [];
    const removedMemberIds: string[] = [];

    if (body.Operations) {
      for (const op of body.Operations) {
        const opName = op.op.toLowerCase();
        const rawVals = Array.isArray(op.value) ? op.value : op.value ? [op.value] : [];
        const ids = rawVals.map((v) => v.value).filter(Boolean);

        if (opName === "add" || opName === "replace") {
          addedMemberIds.push(...ids);
        } else if (opName === "remove") {
          if (op.path && op.path.includes("members[value eq")) {
            const match = op.path.match(/members\[value eq "([^"]+)"\]/);
            if (match?.[1]) removedMemberIds.push(match[1]);
          } else {
            removedMemberIds.push(...ids);
          }
        }
      }
    }

    if (body.members) {
      addedMemberIds.push(...body.members.map((m) => m.value).filter(Boolean));
    }

    const members = await withTransaction(async (client) => {
      // Add operators to this role
      if (addedMemberIds.length > 0) {
        await client.query(
          `update operators
              set role = $1, updated_at = now()
            where organization_id = $2
              and id = any($3::uuid[])`,
          [targetRole, auth.organizationId, addedMemberIds],
        );

        for (const opId of addedMemberIds) {
          await appendAuditEvent(client, {
            organizationId: auth.organizationId,
            requestId: null,
            eventType: "operator.scim_role_synced",
            actorType: "system",
            actorId: "scim:idp",
            payload: {
              operatorId: opId,
              newRole: targetRole,
              sourceGroupId: groupId,
            },
          });
        }
      }

      // Remove operators from this role (demote to auditor / approver as fallback)
      if (removedMemberIds.length > 0) {
        const fallbackRole: OperatorRole = targetRole === "auditor" ? "approver" : "auditor";
        await client.query(
          `update operators
              set role = $1, updated_at = now()
            where organization_id = $2
              and id = any($3::uuid[])
              and role = $4`,
          [fallbackRole, auth.organizationId, removedMemberIds, targetRole],
        );
      }

      const rows = await client.query<{ id: string; display_name: string }>(
        `select id, display_name
           from operators
          where organization_id = $1 and role = $2 and status = 'active'
          order by display_name asc`,
        [auth.organizationId, targetRole],
      );

      return rows.rows.map((r) => ({
        value: r.id,
        display: r.display_name,
        $ref: `/Users/${r.id}`,
        type: "User" as const,
      }));
    });

    const canonicalGroupId = roleToDefaultGroupId(targetRole);
    const groupResource: ScimGroupResource = {
      schemas: [SCIM_SCHEMAS.GROUP],
      id: canonicalGroupId,
      displayName: roleToDefaultGroupName(targetRole),
      members,
      meta: {
        resourceType: "Group",
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        location: `/Groups/${canonicalGroupId}`,
      },
    };

    return NextResponse.json(groupResource, {
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

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ groupId: string }> },
) {
  return PATCH(request, context);
}

export async function DELETE() {
  // Built-in role groups are perpetual in SentinelOps; return 204 No Content
  return new NextResponse(null, { status: 204 });
}
