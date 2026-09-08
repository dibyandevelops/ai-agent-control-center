import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import {
  getDodoPaymentsConfig,
  processDodoPaymentsWebhookEvent,
  verifyDodoPaymentsWebhookSignature,
  type DodoPaymentsSubscriptionEvent,
} from "@/lib/server/dodopayments";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const headers = {
      id: request.headers.get("webhook-id"),
      signature: request.headers.get("webhook-signature"),
      timestamp: request.headers.get("webhook-timestamp"),
    };
    const config = getDodoPaymentsConfig();

    if (config.webhookSecret) {
      const isValid = verifyDodoPaymentsWebhookSignature({
        rawBody,
        headers,
        secret: config.webhookSecret,
      });
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid Dodo Payments webhook signature." },
          { status: 401 },
        );
      }
    }

    const event = JSON.parse(rawBody) as DodoPaymentsSubscriptionEvent;
    if (!event.type || !event.data) {
      return NextResponse.json(
        { error: "Malformed Dodo Payments event payload." },
        { status: 400 },
      );
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await processDodoPaymentsWebhookEvent(client, event);
      await client.query("commit");

      return NextResponse.json({ success: true, result });
    } catch (err) {
      await client.query("rollback").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[Dodo Payments Webhook Error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error." },
      { status: 500 },
    );
  }
}
