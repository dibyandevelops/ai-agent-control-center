import { handlePaddleWebhookRequest } from "@/lib/server/paddle-webhook-route";
import { checkPaddleWebhookSource } from "@/lib/server/paddle-ip-allowlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const source = await checkPaddleWebhookSource(request.headers);
  if (!source.allowed) {
    if (source.reason === "unavailable") {
      return Response.json({ error: "Paddle source IP verification is temporarily unavailable." }, { status: 503 });
    }
    return Response.json({ error: "Webhook source is not authorized." }, { status: 403 });
  }
  return handlePaddleWebhookRequest(request);
}
