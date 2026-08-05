import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { connectGitHubInstallation } from "@/lib/server/github-connections";
import { withTransaction } from "@/lib/server/db";
import {
  exchangeGitHubUserCode,
  verifyGitHubUserInstallationAccess,
} from "@/lib/server/github-app";
import { apiError } from "@/lib/server/http";

const callbackSchema = z.object({
  installationId: z.string().regex(/^\d+$/),
  state: z.string().min(32).max(200),
  code: z.string().min(10).max(500),
});

export async function GET(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    const input = callbackSchema.parse({
      installationId: request.nextUrl.searchParams.get("installation_id"),
      state: request.nextUrl.searchParams.get("state"),
      code: request.nextUrl.searchParams.get("code"),
    });
    const stateHash = createHash("sha256").update(input.state).digest("hex");
    await withTransaction(async (client) => {
      const claimed = await client.query(
        `update github_app_connection_states
            set consumed_at = now()
          where state_hash = $1
            and organization_id = $2
            and operator_id = $3
            and consumed_at is null
            and expires_at > now()
          returning state_hash`,
        [stateHash, operator.organizationId, operator.id],
      );
      if (!claimed.rows[0]) {
        throw new Error("This GitHub installation link is invalid, expired, or already used.");
      }
    });

    const userToken = await exchangeGitHubUserCode(input.code);
    await verifyGitHubUserInstallationAccess(userToken, input.installationId);
    await connectGitHubInstallation({
      organizationId: operator.organizationId,
      operatorId: operator.id,
      operatorEmail: operator.email,
      installationId: input.installationId,
    });
    const redirect = new URL("/dashboard", request.url);
    redirect.searchParams.set("github", "connected");
    return NextResponse.redirect(redirect);
  } catch (error) {
    return apiError(error);
  }
}
