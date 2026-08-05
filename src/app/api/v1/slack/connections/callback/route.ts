import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTransaction } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import {
  claimSlackOAuthState,
  exchangeSlackOAuthCode,
  saveSlackConnection,
} from "@/lib/server/slack-connections";

const callbackSchema = z.object({
  code: z.string().min(5).max(500),
  state: z.string().min(32).max(200),
});

export async function GET(request: NextRequest) {
  try {
    const input = callbackSchema.parse({
      code: request.nextUrl.searchParams.get("code"),
      state: request.nextUrl.searchParams.get("state"),
    });
    const stateHash = createHash("sha256").update(input.state).digest("hex");
    const operator = await withTransaction((client) =>
      claimSlackOAuthState(client, stateHash),
    );
    if (!operator) {
      throw new Error("This Slack connection link is invalid, expired, or already used.");
    }
    const oauth = await exchangeSlackOAuthCode(input.code);
    await saveSlackConnection({
      organizationId: operator.organization_id,
      operatorId: operator.operator_id,
      operatorEmail: operator.email,
      oauth,
    });
    const redirect = new URL("/dashboard", request.url);
    redirect.searchParams.set("view", "integrations");
    redirect.searchParams.set("slack", "connected");
    return NextResponse.redirect(redirect);
  } catch (error) {
    return apiError(error);
  }
}
