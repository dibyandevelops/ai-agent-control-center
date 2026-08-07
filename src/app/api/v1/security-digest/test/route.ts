import { NextResponse } from "next/server";
import { getOperatorSession, requireRecentMfa } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { sendSecurityDigestEmail } from "@/lib/server/security-digest-email";
import { notifySlackOfSecurityDigest } from "@/lib/server/slack";
import { getPool } from "@/lib/server/db";
import { getSentinelOpsPublicUrl } from "@/lib/server/env";

const auditUrl = `${getSentinelOpsPublicUrl()}/dashboard?view=audit&scope=security`;
const payload = {
  date: new Date().toISOString().slice(0, 10), totalEvents: 0, mfaEvents: 0,
  sessionEvents: 0, credentialEvents: 0, identityEvents: 0,
  auditUrl, highlights: [{ label: "This is a manually requested delivery test.", auditUrl }],
};

export async function POST() {
  try {
    const operator = await getOperatorSession();
    if (!operator) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    if (!operatorCan(operator.role, "manage_operators")) return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    await requireRecentMfa(operator);
    const settings = await getPool().query<{ security_digest_channels: Array<"slack" | "email"> }>(`select security_digest_channels from organization_identity_settings where organization_id=$1`, [operator.organizationId]);
    const channels = settings.rows[0]?.security_digest_channels ?? ["slack", "email"];
    const [email, slack] = await Promise.all([
      channels.includes("email") ? sendSecurityDigestEmail(payload) : Promise.resolve({ delivered: false, reason: "disabled" }),
      channels.includes("slack") ? notifySlackOfSecurityDigest({ organizationId: operator.organizationId, ...payload }) : Promise.resolve({ delivered: false, reason: "disabled" }),
    ]);
    return NextResponse.json({ email, slack });
  } catch (error) { return apiError(error); }
}
