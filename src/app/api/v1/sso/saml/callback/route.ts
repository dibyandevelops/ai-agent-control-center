import { NextRequest, NextResponse } from "next/server";
import { apiError } from "@/lib/server/http";
import { loginOperatorWithSaml } from "@/lib/server/auth";
import { finishSamlLogin } from "@/lib/server/saml-sso";

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const response = form.get("SAMLResponse");
    const relayState = form.get("RelayState");
    if (typeof response !== "string" || typeof relayState !== "string") throw new Error("SAMLResponse and RelayState are required.");
    const identity = await finishSamlLogin({ response, relayState });
    const operator = await loginOperatorWithSaml(identity);
    if (!operator) return NextResponse.redirect(new URL("/dashboard?saml=not-authorized", request.url));
    return NextResponse.redirect(new URL("/dashboard?view=overview&saml=connected", request.url));
  } catch (error) { return apiError(error); }
}
