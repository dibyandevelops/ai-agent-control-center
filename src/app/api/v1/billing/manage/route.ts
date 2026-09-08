import { NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import {
  cancelSubscription,
  pauseSubscription,
  reactivateSubscription,
  simulateSubscriptionScenario,
  updatePaymentMethod,
  updateSubscriptionPlan,
} from "@/lib/server/subscription-core";

const manageActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("change_plan"),
    planCode: z.enum(["pilot", "pro", "enterprise"]),
    billingInterval: z.enum(["month", "year"]).default("month"),
  }),
  z.object({
    action: z.literal("cancel"),
    immediately: z.boolean().default(false),
    reason: z.string().default("Customer requested cancellation"),
  }),
  z.object({
    action: z.literal("reactivate"),
  }),
  z.object({
    action: z.literal("pause"),
    pauseMonths: z.number().int().min(1).max(12).default(1),
  }),
  z.object({
    action: z.literal("resume"),
  }),
  z.object({
    action: z.literal("update_payment_method"),
    cardBrand: z.string().min(2).default("visa"),
    cardLast4: z.string().regex(/^\d{4}$/).default("4242"),
    cardExp: z.string().default("12/28"),
  }),
  z.object({
    action: z.literal("simulate_scenario"),
    scenarioKey: z.enum([
      "active_pro",
      "enterprise_annual",
      "past_due",
      "canceled_grace",
      "paused_staging",
      "pilot_reset",
    ]),
  }),
]);

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
        { error: "Admin role required to manage subscription." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const input = manageActionSchema.parse(body);

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("begin");

      let updatedSubscription;

      switch (input.action) {
        case "change_plan":
          updatedSubscription = await updateSubscriptionPlan(client, {
            organizationId: operator.organizationId,
            planCode: input.planCode,
            billingInterval: input.billingInterval,
            operatorId: operator.id,
            actorEmail: operator.email,
          });
          break;

        case "cancel":
          updatedSubscription = await cancelSubscription(client, {
            organizationId: operator.organizationId,
            immediately: input.immediately,
            reason: input.reason,
            operatorId: operator.id,
            actorEmail: operator.email,
          });
          break;

        case "reactivate":
        case "resume":
          updatedSubscription = await reactivateSubscription(client, {
            organizationId: operator.organizationId,
            operatorId: operator.id,
            actorEmail: operator.email,
          });
          break;

        case "pause":
          updatedSubscription = await pauseSubscription(client, {
            organizationId: operator.organizationId,
            pauseMonths: input.pauseMonths,
            operatorId: operator.id,
            actorEmail: operator.email,
          });
          break;

        case "update_payment_method":
          updatedSubscription = await updatePaymentMethod(client, {
            organizationId: operator.organizationId,
            cardBrand: input.cardBrand,
            cardLast4: input.cardLast4,
            cardExp: input.cardExp,
            operatorId: operator.id,
            actorEmail: operator.email,
          });
          break;

        case "simulate_scenario":
          updatedSubscription = await simulateSubscriptionScenario(client, {
            organizationId: operator.organizationId,
            scenarioKey: input.scenarioKey,
            operatorId: operator.id,
            actorEmail: operator.email,
          });
          break;
      }

      await client.query("commit");

      return NextResponse.json({
        success: true,
        subscription: updatedSubscription,
      });
    } catch (err) {
      await client.query("rollback").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
