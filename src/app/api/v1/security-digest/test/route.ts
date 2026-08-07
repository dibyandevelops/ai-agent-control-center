import { NextResponse } from "next/server";
import { getOperatorSession, requireRecentMfa } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { sendSecurityDigestEmail } from "@/lib/server/security-digest-email";
import { notifySlackOfSecurityDigest } from "@/lib/server/slack";

const payload = {
  date: new Date().toISOString().slice(0, 10), totalEvents: 0, mfaEvents: 0,
  sessionEvents: 0, credentialEvents: 0, identityEvents: 0,
  highlights: ["This is a manually requested delivery test."],
};

export async function POST() {
  try {
    const operator = await getOperatorSession();
    if (!operator) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    if (!operatorCan(operator.role, "manage_operators")) return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    await requireRecentMfa(operator);
    const [email, slack] = await Promise.all([
      sendSecurityDigestEmail(payload),
      notifySlackOfSecurityDigest({ organizationId: operator.organizationId, ...payload }),
    ]);
    return NextResponse.json({ email, slack });
  } catch (error) { return apiError(error); }
}
