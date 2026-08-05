import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { slackOAuthRedirectUri } from "@/lib/server/slack-connections";
import { slackAuthorizeUrl } from "@/lib/server/slack-oauth-core";

export async function POST() {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "manage_integrations")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    const env = getServerEnv();
    if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET || !env.SLACK_CREDENTIAL_ENCRYPTION_KEY) {
      return NextResponse.json({ error: "Slack OAuth is not fully configured." }, { status: 503 });
    }
    const state = randomBytes(32).toString("base64url");
    const stateHash = createHash("sha256").update(state).digest("hex");
    await getPool().query(
      `insert into slack_oauth_states (
         state_hash, organization_id, operator_id, expires_at
       ) values ($1, $2, $3, now() + interval '10 minutes')`,
      [stateHash, operator.organizationId, operator.id],
    );
    return NextResponse.json({
      authorizeUrl: slackAuthorizeUrl({
        clientId: env.SLACK_CLIENT_ID,
        redirectUri: slackOAuthRedirectUri(),
        state,
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}
