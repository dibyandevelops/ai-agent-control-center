import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  clearOperatorSession,
  getOperatorSession,
  loginOperator,
} from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { getServerEnv } from "@/lib/server/env";
import { apiError } from "@/lib/server/http";
import { verifyTurnstile } from "@/lib/server/turnstile";

const sessionSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).max(256),
  turnstileToken: z.string().trim().min(1).max(2048).optional(),
});

export async function GET() {
  try {
    const env = getServerEnv();
    const databaseConfigured = Boolean(env.DATABASE_URL);
    const [operator, countResult] = await Promise.all([
      getOperatorSession({ allowPasswordChangeRequired: true }),
      databaseConfigured
        ? getPool().query<{ count: string }>(
            "select count(*)::text as count from operators where status = 'active'",
          )
        : Promise.resolve({ rows: [{ count: "0" }] }),
    ]);
    let paddleCustomerId: string | null = null;
    if (operator && databaseConfigured) {
      const customers = await getPool().query<{ customer_id: string }>(
        `select customer_id from customers
          where organization_id = $1 and left(customer_id, 4) = 'ctm_'
          order by updated_at desc limit 2`,
        [operator.organizationId],
      );
      // Only expose an unambiguous Paddle customer identity resolved from the
      // authenticated workspace. Never accept a customer ID from the browser.
      if (customers.rows.length === 1) {
        paddleCustomerId = customers.rows[0].customer_id;
      }
    }
    return NextResponse.json({
      authenticated: Boolean(operator),
      databaseConfigured,
      operatorAccountsConfigured: Number(countResult.rows[0]?.count ?? 0) > 0,
      operator,
      paddleCustomerId,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = sessionSchema.parse(await request.json());
    const humanVerification = await verifyTurnstile(request, input.turnstileToken);
    if (humanVerification.enabled && !humanVerification.valid) {
      return NextResponse.json(
        { error: "Human verification failed. Please complete the security check." },
        { status: 403 },
      );
    }
    const operator = await loginOperator(input.email, input.password);
    if (!operator) {
      return NextResponse.json(
        { error: "Invalid email or password, or the account is temporarily locked." },
        { status: 401 },
      );
    }
    return NextResponse.json({ authenticated: true, operator });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE() {
  await clearOperatorSession();
  return NextResponse.json({ authenticated: false });
}
