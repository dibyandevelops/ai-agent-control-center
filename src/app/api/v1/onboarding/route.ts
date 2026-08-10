import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loginOperator } from "@/lib/server/auth";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";
import { createSelfServiceOrganization } from "@/lib/server/onboarding";

const schema = z.object({
  organizationName: z.string().trim().min(2).max(100),
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(256),
});

export async function POST(request: NextRequest) {
  try {
    if (getServerEnv().SELF_SERVICE_SIGNUP_ENABLED !== "true") {
      return NextResponse.json({ error: "Self-service onboarding is not enabled for this environment." }, { status: 403 });
    }
    const input = schema.parse(await request.json());
    const created = await createSelfServiceOrganization(input);
    const operator = await loginOperator(input.email, input.password);
    if (!operator) throw new Error("Workspace created, but the first administrator could not be signed in.");
    return NextResponse.json({ organization: { id: created.organizationId, name: created.organizationName }, operator }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
