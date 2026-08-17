import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/server/http";
import { consumeOnboardingRateLimit } from "@/lib/server/onboarding-rate-limit";
import { requestPasswordReset } from "@/lib/server/password-reset";

const forgotSchema = z.object({
  email: z.string().trim().email().max(254),
});

export async function POST(request: NextRequest) {
  try {
    const input = forgotSchema.parse(await request.json());
    const email = input.email.trim().toLowerCase();

    if (!(await consumeOnboardingRateLimit(request, `pwd_reset:${email}`))) {
      return NextResponse.json(
        { error: "Too many password reset requests. Please wait 15 minutes and try again." },
        { status: 429, headers: { "retry-after": "900" } },
      );
    }

    await requestPasswordReset(email);

    return NextResponse.json(
      { message: "If an active account exists with that email, a password reset link has been sent." },
      { status: 202 },
    );
  } catch (error) {
    return apiError(error);
  }
}
