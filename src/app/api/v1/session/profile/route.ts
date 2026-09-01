import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool, withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { appendAuditEvent } from "@/lib/server/audit";

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
});

export async function PATCH(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }

    const input = profileSchema.parse(await request.json());

    await withTransaction(async (client) => {
      await client.query(
        `update operators
            set display_name = $1, updated_at = now()
          where id = $2 and organization_id = $3`,
        [input.displayName, operator.id, operator.organizationId],
      );

      await appendAuditEvent(client, {
        organizationId: operator.organizationId,
        requestId: null,
        eventType: "operator.profile_updated",
        actorType: "human",
        actorId: operator.email,
        payload: {
          operatorId: operator.id,
          previousDisplayName: operator.displayName,
          newDisplayName: input.displayName,
        },
      });
    });

    return NextResponse.json({
      success: true,
      displayName: input.displayName,
    });
  } catch (error) {
    return apiError(error);
  }
}
