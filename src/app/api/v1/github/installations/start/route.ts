import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";

export async function POST() {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "govern_releases")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    const env = getServerEnv();
    if (
      !env.GITHUB_APP_SLUG || !env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY ||
      !env.GITHUB_APP_CLIENT_ID || !env.GITHUB_APP_CLIENT_SECRET
    ) {
      return NextResponse.json(
        { error: "GitHub App installation is not fully configured." },
        { status: 503 },
      );
    }
    const state = randomBytes(32).toString("base64url");
    const stateHash = createHash("sha256").update(state).digest("hex");
    await getPool().query(
      `insert into github_app_connection_states (
         state_hash, organization_id, operator_id, expires_at
       ) values ($1, $2, $3, now() + interval '10 minutes')`,
      [stateHash, operator.organizationId, operator.id],
    );
    const installUrl = new URL(
      `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`,
    );
    installUrl.searchParams.set("state", state);
    return NextResponse.json({ installUrl: installUrl.toString() });
  } catch (error) {
    return apiError(error);
  }
}
