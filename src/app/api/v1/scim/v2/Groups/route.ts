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

interface OperatorMemberRow {
  id: string;
  display_name: string;
  role: OperatorRole;
  created_at: Date;
  updated_at: Date;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateScimRequest(request);
    const pool = getPool();

    const result = await pool.query<OperatorMemberRow>(
      `select id, display_name, role, created_at, updated_at
         from operators
        where organization_id = $1 and status = 'active'
        order by display_name asc`,
      [auth.organizationId],
    );

    const roles: OperatorRole[] = ["admin", "approver", "auditor"];
    const groups: ScimGroupResource[] = roles.map((role) => {
      const members: ScimGroupMember[] = result.rows
        .filter((r) => r.role === role)
        .map((r) => ({
          value: r.id,
          display: r.display_name,
          $ref: `/Users/${r.id}`,
          type: "User",
        }));

      return {
        schemas: [SCIM_SCHEMAS.GROUP],
        id: roleToDefaultGroupId(role),
        displayName: roleToDefaultGroupName(role),
        members,
        meta: {
          resourceType: "Group",
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          location: `/Groups/${roleToDefaultGroupId(role)}`,
        },
      };
    });

    return NextResponse.json(
      {
        schemas: [SCIM_SCHEMAS.LIST_RESPONSE],
        totalResults: groups.length,
        startIndex: 1,
        itemsPerPage: groups.length,
        Resources: groups,
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

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateScimRequest(request);
    const body = (await request.json()) as {
      displayName?: string;
      members?: Array<{ value: string }>;
    };

    const displayName = body.displayName?.trim() || "SentinelOps Approvers";
    const targetRole: OperatorRole = resolveRoleFromGroupName(displayName) || "approver";
    const memberIds = (body.members || []).map((m) => m.value).filter(Boolean);

    const updatedMembers: ScimGroupMember[] = await withTransaction(async (client) => {
      if (memberIds.length > 0) {
        await client.query(
          `update operators
              set role = $1, updated_at = now()
            where organization_id = $2
              and id = any($3::uuid[])`,
          [targetRole, auth.organizationId, memberIds],
        );

        for (const opId of memberIds) {
          await appendAuditEvent(client, {
            organizationId: auth.organizationId,
            requestId: null,
            eventType: "operator.scim_role_synced",
            actorType: "system",
            actorId: "scim:idp",
            payload: {
              operatorId: opId,
              newRole: targetRole,
              sourceGroup: displayName,
            },
          });
        }
      }

      const rows = await client.query<{ id: string; display_name: string }>(
        `select id, display_name
           from operators
          where organization_id = $1 and role = $2 and status = 'active'`,
        [auth.organizationId, targetRole],
      );

      return rows.rows.map((r) => ({
        value: r.id,
        display: r.display_name,
        $ref: `/Users/${r.id}`,
        type: "User" as const,
      }));
    });

    const groupId = roleToDefaultGroupId(targetRole);
    const groupResource: ScimGroupResource = {
      schemas: [SCIM_SCHEMAS.GROUP],
      id: groupId,
      displayName: roleToDefaultGroupName(targetRole),
      members: updatedMembers,
      meta: {
        resourceType: "Group",
        created: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        location: `/Groups/${groupId}`,
      },
    };

    return NextResponse.json(groupResource, {
      status: 201,
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
