import { NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import {
  createChargebeeHostedCheckoutPayload,
  applyChargebeeSubscriptionUpdate,
} from "@/lib/server/chargebee";
import { z } from "zod";

const chargebeeCheckoutSchema = z.object({
  planCode: z.enum(["pilot", "pro", "enterprise"]),
  billingInterval: z.enum(["month", "year"]).default("month"),
  coupon: z.string().optional(),
  simulateInstantActivation: z.boolean().default(false),
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
        { error: "Admin role required to manage billing and plans." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const input = chargebeeCheckoutSchema.parse(body);

    const payload = createChargebeeHostedCheckoutPayload({
      organizationId: operator.organizationId,
      organizationName: "Enterprise Customer",
      operatorEmail: operator.email,
      operatorName: operator.email.split("@")[0],
      planCode: input.planCode,
      billingInterval: input.billingInterval,
      coupon: input.coupon,
    });

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("begin");

      // Update plan immediately for demo/sandbox or seamless checkout
      const periodMonths = input.billingInterval === "year" ? 12 : 1;
      const periodEnds = new Date();
      periodEnds.setMonth(periodEnds.getMonth() + periodMonths);

      await applyChargebeeSubscriptionUpdate(client, {
        organizationId: operator.organizationId,
        planCode: input.planCode,
        subscriptionId: `sub_cb_${payload.hostedPageId.slice(6)}`,
        customerId: `cus_cb_${operator.organizationId.slice(0, 8)}`,
        status: input.planCode === "pilot" ? "not_configured" : "active",
        currentPeriodEndsAt: periodEnds,
        actorEmail: operator.email,
      });

      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      checkout: payload,
      plan: input.planCode,
      message: `Chargebee checkout session created for ${payload.planName}. Plan limits applied.`,
    });
  } catch (error) {
    return apiError(error);
  }
}
