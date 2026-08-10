import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendAuditEvent } from "@/lib/server/audit";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { hashOnboardingVerificationToken } from "@/lib/server/onboarding-email";

const tokenSchema = z.string().min(40).max(200);

export async function GET(request: NextRequest) {
  try {
    const token = tokenSchema.parse(request.nextUrl.searchParams.get("token"));
    const tokenHash = hashOnboardingVerificationToken(token);
    const verified = await withTransaction(async (client) => {
      const result = await client.query<{ operator_id: string; organization_id: string; email: string }>(
        `select verification.operator_id, operator.organization_id, operator.email
           from onboarding_email_verifications verification
           join operators operator on operator.id = verification.operator_id
          where verification.token_hash = $1
            and verification.verified_at is null
            and verification.expires_at > now()
          for update`,
        [tokenHash],
      );
      const row = result.rows[0];
      if (!row) return null;
      await client.query("update onboarding_email_verifications set verified_at = now() where operator_id = $1", [row.operator_id]);
      await client.query("update operators set status = 'active', updated_at = now() where id = $1 and status = 'pending_verification'", [row.operator_id]);
      await appendAuditEvent(client, {
        organizationId: row.organization_id,
        requestId: null,
        eventType: "operator.email_verified",
        actorType: "human",
        actorId: row.email,
        payload: { operatorId: row.operator_id, source: "self_service" },
      });
      return row;
    });
    if (!verified) return NextResponse.redirect(new URL("/get-started?verification=invalid", request.url));
    return NextResponse.redirect(new URL("/dashboard?verification=success", request.url));
  } catch (error) {
    return apiError(error);
  }
}
