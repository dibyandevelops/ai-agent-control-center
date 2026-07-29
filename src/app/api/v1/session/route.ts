import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  clearAdminSession,
  createAdminSession,
  hasAdminSession,
  verifyAdminToken,
} from "@/lib/server/auth";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";

const sessionSchema = z.object({
  token: z.string().min(1),
});

export async function GET(request: NextRequest) {
  const env = getServerEnv();
  return NextResponse.json({
    authenticated: await hasAdminSession(request),
    databaseConfigured: Boolean(env.DATABASE_URL),
    adminTokenConfigured: Boolean(env.SENTINELOPS_ADMIN_TOKEN),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { token } = sessionSchema.parse(await request.json());
    if (!verifyAdminToken(token)) {
      return NextResponse.json(
        { error: "Invalid operator token." },
        { status: 401 },
      );
    }
    await createAdminSession();
    return NextResponse.json({ authenticated: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({ authenticated: false });
}
