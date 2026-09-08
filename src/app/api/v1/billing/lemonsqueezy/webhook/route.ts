import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/server/db";
import {
  getLemonSqueezyConfig,
  processLemonSqueezyWebhookEvent,
  verifyLemonSqueezyWebhookSignature,
  type LemonSqueezySubscriptionEvent,
} from "@/lib/server/lemonsqueezy";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-signature");
    const config = getLemonSqueezyConfig();

    if (config.webhookSecret) {
      const isValid = verifyLemonSqueezyWebhookSignature(
        rawBody,
        signature,
        config.webhookSecret,
      );
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid HMAC signature." },
          { status: 401 },
        );
      }
    }

    const event = JSON.parse(rawBody) as LemonSqueezySubscriptionEvent;
    if (!event.meta?.event_name || !event.data?.attributes) {
      return NextResponse.json(
        { error: "Malformed Lemon Squeezy event payload." },
        { status: 400 },
      );
    }

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("begin");
      const result = await processLemonSqueezyWebhookEvent(client, event);
      await client.query("commit");

      return NextResponse.json({ success: true, result });
    } catch (err) {
      await client.query("rollback").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("[Lemon Squeezy Webhook Error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error." },
      { status: 500 },
    );
  }
}
