import { NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const checkedAt = new Date().toISOString();
  if (!getServerEnv().DATABASE_URL) {
    return NextResponse.json(
      {
        service: "sentinelops",
        status: "not_ready",
        database: "not_configured",
        checkedAt,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }

  try {
    await getPool().query("select 1");
    return NextResponse.json(
      {
        service: "sentinelops",
        status: "ok",
        database: "reachable",
        checkedAt,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch {
    return NextResponse.json(
      {
        service: "sentinelops",
        status: "not_ready",
        database: "unreachable",
        checkedAt,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }
}
