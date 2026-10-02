import { NextResponse } from "next/server";
import type { EventEntity } from "@paddle/paddle-node-sdk";
import { getPool } from "@/lib/server/db";
import { processPaddleEvent, unmarshalPaddleWebhook } from "@/lib/server/paddle";

export async function handlePaddleWebhookRequest(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("paddle-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Paddle-Signature header." }, { status: 401 });
  }

  let event: EventEntity;
  try {
    // Keep the raw body intact; Paddle's SDK verifies the signature before decoding its payload.
    event = await unmarshalPaddleWebhook(rawBody, signature);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("not configured") || message.includes("PADDLE_ENVIRONMENT")) {
      console.error("[Paddle Webhook Configuration]", message);
      return NextResponse.json({ error: "Paddle webhook verification is not configured." }, { status: 503 });
    }
    return NextResponse.json({ error: "Invalid Paddle webhook signature or payload." }, { status: 401 });
  }

  const client = await getPool().connect();
  try {
    await client.query("begin");
    const result = await processPaddleEvent(client, event);
    await client.query("commit");
    return NextResponse.json({ success: true, result });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error("[Paddle Webhook Error]", error);
    return NextResponse.json({ error: "Paddle event processing failed." }, { status: 500 });
  } finally {
    client.release();
  }
}
