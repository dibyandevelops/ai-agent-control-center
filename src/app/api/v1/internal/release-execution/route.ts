import { NextRequest, NextResponse } from "next/server";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";
import { hasValidInternalBearer } from "@/lib/server/internal-auth";
import { runApprovedReleaseWorker } from "@/lib/server/release-execution-worker";
import { runApprovedDraftGovernanceWorker } from "@/lib/server/release-governance-worker";

export const maxDuration = 60;

async function runReleaseExecution(request: NextRequest) {
  try {
    const env = getServerEnv();
    if (!env.SENTINELOPS_CRON_SECRET) {
      return NextResponse.json(
        { error: "Release execution worker is not configured." },
        { status: 503 },
      );
    }
    if (!hasValidInternalBearer(request, env.SENTINELOPS_CRON_SECRET)) {
      return NextResponse.json(
        { error: "Invalid worker credential." },
        { status: 401 },
      );
    }
    const [draftCreation, draftGovernance] = await Promise.all([
      runApprovedReleaseWorker(),
      runApprovedDraftGovernanceWorker(),
    ]);
    return NextResponse.json({ draftCreation, draftGovernance });
  } catch (error) {
    return apiError(error);
  }
}

export const GET = runReleaseExecution;
export const POST = runReleaseExecution;
