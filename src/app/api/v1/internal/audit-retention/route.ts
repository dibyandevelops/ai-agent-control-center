import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";
import { hasValidInternalBearer } from "@/lib/server/internal-auth";
import { runAuditRetentionWorker } from "@/lib/server/audit-retention";

export const maxDuration = 60;

async function runAuditRetention(request: NextRequest) {
  try {
    const env = getServerEnv();
    if (!env.SENTINELOPS_CRON_SECRET) {
      return NextResponse.json(
        { error: "Audit retention worker is not configured." },
        { status: 503 },
      );
    }
    if (!hasValidInternalBearer(request, env.SENTINELOPS_CRON_SECRET)) {
      return NextResponse.json(
        { error: "Invalid dispatcher credential." },
        { status: 401 },
      );
    }
    const summary = await runAuditRetentionWorker();
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    return apiError(error);
  }
}

export const GET = runAuditRetention;
export const POST = runAuditRetention;
