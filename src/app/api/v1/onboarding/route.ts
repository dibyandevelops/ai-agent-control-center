import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";
import { createSelfServiceOrganization } from "@/lib/server/onboarding";
import { onboardingEmailConfigured, sendOnboardingVerificationEmail } from "@/lib/server/onboarding-email";
import { consumeOnboardingRateLimit } from "@/lib/server/onboarding-rate-limit";
import { verifyTurnstile } from "@/lib/server/turnstile";

const schema = z.object({
  organizationName: z.string().trim().min(2).max(100),
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(256),
  turnstileToken: z.string().trim().min(1).max(2048).optional(),
  planCode: z.enum(["pilot", "pro", "enterprise"]).optional().default("pilot"),
  billingInterval: z.enum(["month", "year"]).optional().default("month"),
});

export async function POST(request: NextRequest) {
  try {
    if (getServerEnv().SELF_SERVICE_SIGNUP_ENABLED !== "true") {
      return NextResponse.json({ error: "Self-service onboarding is not enabled for this environment." }, { status: 403 });
    }
    if (!onboardingEmailConfigured() && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Workspace onboarding email is not configured for this environment." }, { status: 503 });
    }
    const input = schema.parse(await request.json());
    const humanVerification = await verifyTurnstile(request, input.turnstileToken);
    if (humanVerification.enabled && !humanVerification.configured) {
      return NextResponse.json({ error: "Human verification is not configured for this environment." }, { status: 503 });
    }
    if (humanVerification.enabled && !humanVerification.valid) {
      return NextResponse.json({ error: "Human verification failed. Please try again." }, { status: 403 });
    }
    if (!(await consumeOnboardingRateLimit(request, input.email))) {
      return NextResponse.json(
        { error: "Too many workspace-creation attempts. Please wait 15 minutes and try again." },
        { status: 429, headers: { "retry-after": "900" } },
      );
    }
    const created = await createSelfServiceOrganization(input);
    const delivery = await sendOnboardingVerificationEmail({
      email: input.email,
      displayName: input.displayName,
      organizationName: created.organizationName,
      token: created.verificationToken,
    });
    if (!delivery.delivered) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[Onboarding] Dev email notice: ${delivery.reason}. Verification token: ${created.verificationToken}`);
        return NextResponse.json({
          organization: { id: created.organizationId, name: created.organizationName },
          verification: "dev_logged",
          devToken: created.verificationToken,
          devVerificationUrl: `/api/v1/onboarding/verify?token=${created.verificationToken}`,
        }, { status: 202 });
      }
      return NextResponse.json({ error: "Workspace created, but the verification email could not be delivered. Contact support to resend it." }, { status: 503 });
    }
    return NextResponse.json({ organization: { id: created.organizationId, name: created.organizationName }, verification: "sent" }, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
