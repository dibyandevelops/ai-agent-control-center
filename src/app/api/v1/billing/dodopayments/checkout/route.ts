import { NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { getDodoPaymentsConfig, resolveDodoProductId } from "@/lib/server/dodopayments-core";
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
    const config = getDodoPaymentsConfig();

    let checkoutUrl: string | null = null;
    const isLive = Boolean(config.apiKey);

    if (isLive && input.planCode !== "pilot") {
      const productId = resolveDodoProductId(input.planCode, input.billingInterval, config);
      const origin = request.headers.get("origin") || "http://localhost:3000";
      const returnUrl = input.redirectUrl || `${origin}/dashboard/settings?billing_status=success`;

      try {
        const dodoRes = await fetch(`${config.baseUrl}/checkouts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            product_cart: [
              {
                product_id: productId,
                quantity: 1,
              },
            ],
            customer: {
              email: operator.email,
              name: operator.organizationName || operator.email.split("@")[0],
            },
            metadata: {
              organization_id: operator.organizationId,
              operator_id: operator.id,
              plan_code: input.planCode,
              billing_interval: input.billingInterval,
            },
            return_url: returnUrl,
          }),
        });

        if (dodoRes.ok) {
          const dodoData = await dodoRes.json();
          checkoutUrl = dodoData.checkout_url || dodoData.payment_link || null;
        } else {
          console.warn("[Dodo Payments] Live checkout API returned non-200:", await dodoRes.text());
        }
      } catch (dodoErr) {
        console.error("[Dodo Payments] Error calling checkout API:", dodoErr);
      }
    }

    // If sandbox / simulation or instant activation requested
    if (input.simulateInstantActivation || !checkoutUrl) {
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

    const fallbackUrl = `/dashboard/settings?billing_status=activated&plan=${input.planCode}`;

    return NextResponse.json({
      success: true,
      url: checkoutUrl || fallbackUrl,
      isLive: Boolean(checkoutUrl),
      planCode: input.planCode,
      billingInterval: input.billingInterval,
    });
  } catch (error) {
    return apiError(error);
  }
}
