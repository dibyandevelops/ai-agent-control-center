import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/server/http";
import { startSamlLogin } from "@/lib/server/saml-sso";

const schema = z.object({ email: z.string().email() });

export async function POST(request: NextRequest) {
  try {
    const input = schema.parse(await request.json());
    const url = await startSamlLogin(input.email, request.headers.get("host") ?? undefined);
    return NextResponse.json({ authorizeUrl: url });
  } catch (error) { return apiError(error); }
}
