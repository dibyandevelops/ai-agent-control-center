import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/server/http";
import { acceptInvitation, validateInvitationToken } from "@/lib/server/invitations";

const acceptSchema = z.object({
  token: z.string().trim().min(20).max(200),
  displayName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(256),
});

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Invitation token is required." }, { status: 400 });
    }
    const invitation = await validateInvitationToken(token);
    return NextResponse.json({ valid: true, invitation });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = acceptSchema.parse(await request.json());
    const operator = await acceptInvitation(input);
    return NextResponse.json({ accepted: true, operator }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
