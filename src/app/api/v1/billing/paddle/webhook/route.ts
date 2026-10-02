import { handlePaddleWebhookRequest } from "@/lib/server/paddle-webhook-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handlePaddleWebhookRequest(request);
}
