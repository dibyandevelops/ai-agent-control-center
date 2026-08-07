import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { regenerateMfaRecoveryCodes } from "@/lib/server/mfa";

const schema = z.object({ code: z.string().min(6).max(32) });

export async function POST(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    const recoveryCodes = await regenerateMfaRecoveryCodes(operator, schema.parse(await request.json()).code);
    return NextResponse.json({ recoveryCodes });
  } catch (error) {
    return apiError(error);
  }
}
