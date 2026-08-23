import { NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession, requireRecentMfa } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import {
  revokeOrganizationHttpsWebhook,
  updateOrganizationHttpsWebhook,
} from "@/lib/server/https-webhooks";

const patchSchema = z.object({
  enabled: z.boolean(),
});

async function requireWebhookAdmin() {
  const operator = await getOperatorSession();
  if (!operator) {
    return { error: NextResponse.json({ error: "Operator authentication required." }, { status: 401 }) };
  }
  if (!operatorCan(operator.role, "manage_integrations")) {
    return { error: NextResponse.json({ error: "Admin role required." }, { status: 403 }) };
  }
  await requireRecentMfa(operator);
  return { operator };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ webhookId: string }> },
) {
  try {
    const auth = await requireWebhookAdmin();
    if ("error" in auth && auth.error) return auth.error;
    const { webhookId } = await context.params;
    const input = patchSchema.parse(await request.json());
    const webhook = await updateOrganizationHttpsWebhook({
      organizationId: auth.operator!.organizationId,
      operatorEmail: auth.operator!.email,
      webhookId,
      enabled: input.enabled,
    });
    return NextResponse.json({ webhook });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ webhookId: string }> },
) {
  try {
    const auth = await requireWebhookAdmin();
    if ("error" in auth && auth.error) return auth.error;
    const { webhookId } = await context.params;
    await revokeOrganizationHttpsWebhook({
      organizationId: auth.operator!.organizationId,
      operatorEmail: auth.operator!.email,
      webhookId,
    });
    return NextResponse.json({ revoked: true });
  } catch (error) {
    return apiError(error);
  }
}
