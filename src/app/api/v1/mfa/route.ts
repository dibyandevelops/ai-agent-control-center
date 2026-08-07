import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { beginMfaEnrollment, confirmMfaEnrollment, getMfaStatus } from "@/lib/server/mfa";
const schema = z.object({ action: z.literal("confirm"), secret: z.string().min(16).max(128), code: z.string().min(6).max(32) });
export async function GET() { try { const operator = await getOperatorSession(); if (!operator) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 }); return NextResponse.json(await getMfaStatus(operator)); } catch (error) { return apiError(error); } }
export async function POST(request: NextRequest) { try { const operator = await getOperatorSession(); if (!operator) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 }); const input = schema.parse(await request.json()); const recoveryCodes = await confirmMfaEnrollment(operator, input.secret, input.code); return NextResponse.json({ enabled: true, recoveryCodes }); } catch (error) { return apiError(error); } }
export async function PUT() { try { const operator = await getOperatorSession(); if (!operator) return NextResponse.json({ error: "Operator authentication required." }, { status: 401 }); return NextResponse.json(beginMfaEnrollment(operator)); } catch (error) { return apiError(error); } }
