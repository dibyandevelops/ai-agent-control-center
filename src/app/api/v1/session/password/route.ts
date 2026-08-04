import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  changeOperatorPassword,
  getOperatorSession,
} from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(12).max(256),
  newPassword: z.string().min(12).max(256),
});

export async function PATCH(request: NextRequest) {
  try {
    const operator = await getOperatorSession({
      allowPasswordChangeRequired: true,
    });
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }
    const input = passwordChangeSchema.parse(await request.json());
    const result = await changeOperatorPassword(
      operator,
      input.currentPassword,
      input.newPassword,
    );
    if (!result.ok) {
      if (result.reason === "invalid_current") {
        return NextResponse.json(
          { error: "The current password is incorrect." },
          { status: 401 },
        );
      }
      if (result.reason === "same_password") {
        return NextResponse.json(
          { error: "Choose a password different from the current password." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "The password changed in another session. Sign in again." },
        { status: 409 },
      );
    }
    return NextResponse.json({
      changed: true,
      operator: result.operator,
    });
  } catch (error) {
    return apiError(error);
  }
}
