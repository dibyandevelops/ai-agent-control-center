import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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
    const input = callbackSchema.parse({
      installationId: request.nextUrl.searchParams.get("installation_id"),
      state: request.nextUrl.searchParams.get("state"),
      code: request.nextUrl.searchParams.get("code"),
    });
    const stateHash = createHash("sha256").update(input.state).digest("hex");
    const operator = await withTransaction(async (client) => {
      const claimed = await client.query<{
        organization_id: string;
        operator_id: string;
        email: string;
      }>(
        `update github_app_connection_states connection_state
            set consumed_at = now()
           from operators op
          where connection_state.state_hash = $1
            and op.id = connection_state.operator_id
            and op.organization_id = connection_state.organization_id
            and op.status = 'active'
            and connection_state.consumed_at is null
            and connection_state.expires_at > now()
          returning connection_state.organization_id, connection_state.operator_id, op.email`,
        [stateHash],
      );
      const row = claimed.rows[0];
      if (!row) {
        throw new Error("This GitHub installation link is invalid, expired, or already used.");
      }
      return {
        organizationId: row.organization_id,
        id: row.operator_id,
        email: row.email,
      };
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
