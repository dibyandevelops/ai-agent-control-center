import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { appendAuditEvent } from "@/lib/server/audit";
import { getPool, withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import {
  createOnboardingVerificationToken,
  onboardingEmailConfigured,
  sendOnboardingVerificationEmail,
} from "@/lib/server/onboarding-email";
import { consumeOnboardingRateLimit } from "@/lib/server/onboarding-rate-limit";

const schema = z.object({
  email: z.string().trim().email().max(254),
});

export async function POST(request: NextRequest) {
  try {
    if (!onboardingEmailConfigured()) {
      return NextResponse.json(
        { error: "Workspace onboarding email is not configured for this environment." },
        { status: 503 },
      );
    }
    const input = schema.parse(await request.json());
    const email = input.email.trim().toLowerCase();

    if (!(await consumeOnboardingRateLimit(request, email))) {
      return NextResponse.json(
        { error: "Too many verification attempts. Please wait 15 minutes and try again." },
        { status: 429, headers: { "retry-after": "900" } },
      );
    }

    const operatorResult = await getPool().query<{
      id: string;
      organization_id: string;
      organization_name: string;
      display_name: string;
      email: string;
      status: string;
    }>(
      `select op.id, op.organization_id, org.name as organization_name,
              op.display_name, op.email, op.status
         from operators op
         join organizations org on org.id = op.organization_id
        where op.email = $1 and op.status = 'pending_verification'
        limit 1`,
      [email],
    );

    const operator = operatorResult.rows[0];
    if (operator) {
      const verification = createOnboardingVerificationToken();
      await withTransaction(async (client) => {
        await client.query(
          `insert into onboarding_email_verifications (operator_id, token_hash, expires_at)
           values ($1, $2, now() + interval '24 hours')
           on conflict (operator_id) do update set
             token_hash = excluded.token_hash,
             expires_at = excluded.expires_at,
             verified_at = null`,
          [operator.id, verification.hash],
        );
        await appendAuditEvent(client, {
          organizationId: operator.organization_id,
          requestId: null,
          eventType: "operator.verification_resent",
          actorType: "human",
          actorId: operator.email,
          payload: { operatorId: operator.id, source: "self_service" },
        });
      });

      await sendOnboardingVerificationEmail({
        email: operator.email,
        displayName: operator.display_name,
        organizationName: operator.organization_name,
        token: verification.token,
      });
    }

    // Generic response to avoid account enumeration
    return NextResponse.json(
      { message: "If a pending verification exists for this email, a new verification link has been sent." },
      { status: 202 },
    );
  } catch (error) {
    return apiError(error);
  }
}
