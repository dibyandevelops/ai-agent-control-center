import { NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { createLemonSqueezyCheckoutPayload } from "@/lib/server/lemonsqueezy-core";
import { getPool } from "@/lib/server/db";
import { updateSubscriptionPlan } from "@/lib/server/subscription-core";

const checkoutSchema = z.object({
  planCode: z.enum(["pilot", "pro", "enterprise"]),
  billingInterval: z.enum(["month", "year"]).default("month"),
  redirectUrl: z.string().url().optional(),
  simulateInstantActivation: z.boolean().optional(),
});

export async function POST(request: Request) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }
    if (!operatorCan(operator.role, "manage_operators")) {
      return NextResponse.json(
        { error: "Admin role required to manage billing." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const input = checkoutSchema.parse(body);

    const checkoutResult = createLemonSqueezyCheckoutPayload({
      organizationId: operator.organizationId,
      organizationName: operator.organizationName || "Aperture Labs",
      operatorId: operator.id,
      operatorEmail: operator.email,
      planCode: input.planCode,
      billingInterval: input.billingInterval,
      redirectUrl: input.redirectUrl,
    });

    // If simulating in local dev or sandbox
    if (input.simulateInstantActivation || !checkoutResult.isLive) {
      const pool = getPool();
      const client = await pool.connect();
      try {
        await client.query("begin");
        await updateSubscriptionPlan(client, {
          organizationId: operator.organizationId,
          planCode: input.planCode,
          billingInterval: input.billingInterval,
          operatorId: operator.id,
          actorEmail: operator.email,
        });
        await client.query("commit");
      } catch (err) {
        await client.query("rollback").catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    }

    return NextResponse.json({
      success: true,
      url: checkoutResult.url,
      isLive: checkoutResult.isLive,
      planCode: checkoutResult.planCode,
      billingInterval: checkoutResult.billingInterval,
      amount: checkoutResult.amount,
      currency: checkoutResult.currency,
      provider: "lemonsqueezy",
    });
  } catch (error) {
    return apiError(error);
  }
}
