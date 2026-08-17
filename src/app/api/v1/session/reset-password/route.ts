import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/server/http";
import {
  resetPasswordWithToken,
  validatePasswordResetToken,
} from "@/lib/server/password-reset";

const resetSchema = z.object({
  token: z.string().trim().min(20).max(200),
  newPassword: z.string().min(12).max(256),
});

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Password reset token is required." }, { status: 400 });
    }
    const result = await validatePasswordResetToken(token);
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = resetSchema.parse(await request.json());
    const result = await resetPasswordWithToken(input);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return apiError(error);
  }
}
