import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession, requireRecentMfa } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import {
  getOrganizationIdentitySettings,
  updateAllowedEmailDomains,
  updateSessionPolicy,
  updateMfaRequirement,
  updateSecurityDigestPreferences,
} from "@/lib/server/identity-provisioning";
import { operatorCan } from "@/lib/server/operator-roles";

const updateSchema = z.object({
  allowedEmailDomains: z.array(z.string().min(3).max(253)).max(25).optional(),
  sessionPolicy: z.object({
    maxDurationMinutes: z.number().int().min(30).max(1440),
    idleTimeoutMinutes: z.number().int().min(5).max(480),
  }).optional(),
  mfaRequiredForSensitiveActions: z.boolean().optional(),
  // Vercel Hobby only invokes cron jobs once per day. Keep the saved preference
  // aligned with the configured 08:00 UTC schedule until the deployment moves
  // to a plan that supports hourly invocations.
  securityDigest: z.object({ channels: z.array(z.enum(["slack", "email"])).min(1).max(2), hourUtc: z.literal(8) }).optional(),
}).refine((value) => value.allowedEmailDomains || value.sessionPolicy || value.mfaRequiredForSensitiveActions !== undefined || value.securityDigest, {
  message: "At least one identity setting is required.",
}).refine((value) => !value.sessionPolicy || value.sessionPolicy.idleTimeoutMinutes <= value.sessionPolicy.maxDurationMinutes, {
  message: "Idle timeout cannot exceed the maximum session duration.",
  path: ["sessionPolicy", "idleTimeoutMinutes"],
});

async function requireAdmin() {
  const operator = await getOperatorSession();
  if (!operator) return { operator: null, response: NextResponse.json({ error: "Operator authentication required." }, { status: 401 }) };
  if (!operatorCan(operator.role, "manage_operators")) {
    return { operator: null, response: NextResponse.json({ error: "Admin role required." }, { status: 403 }) };
  }
  return { operator, response: null };
}

export async function GET() {
  try {
    const authorization = await requireAdmin();
    if (!authorization.operator) return authorization.response;
    return NextResponse.json(await getOrganizationIdentitySettings(authorization.operator.organizationId));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authorization = await requireAdmin();
    if (!authorization.operator) return authorization.response;
    const input = updateSchema.parse(await request.json());
    const context = {
      organizationId: authorization.operator.organizationId,
      operatorId: authorization.operator.id,
      operatorEmail: authorization.operator.email,
    };
    if (input.allowedEmailDomains) {
      return NextResponse.json(await updateAllowedEmailDomains({ ...context, domains: input.allowedEmailDomains }));
    }
    if (input.mfaRequiredForSensitiveActions !== undefined) {
      return NextResponse.json(await updateMfaRequirement({ ...context, required: input.mfaRequiredForSensitiveActions }));
    }
    if (input.securityDigest) return NextResponse.json(await updateSecurityDigestPreferences({ ...context, ...input.securityDigest }));
    return NextResponse.json(await updateSessionPolicy({ ...context, ...input.sessionPolicy! }));
  } catch (error) {
    return apiError(error);
  }
}
