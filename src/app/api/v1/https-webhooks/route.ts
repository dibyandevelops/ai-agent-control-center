import { NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession, requireRecentMfa } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import {
  createOrganizationHttpsWebhook,
  listOrganizationHttpsWebhooks,
} from "@/lib/server/https-webhooks";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  destinationUrl: z.string().url(),
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

export async function GET() {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    const webhooks = await listOrganizationHttpsWebhooks(operator.organizationId);
    return NextResponse.json({ webhooks });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireWebhookAdmin();
    if ("error" in auth && auth.error) return auth.error;
    const input = createSchema.parse(await request.json());
    const created = await createOrganizationHttpsWebhook({
      organizationId: auth.operator!.organizationId,
      operatorId: auth.operator!.id,
      operatorEmail: auth.operator!.email,
      name: input.name,
      destinationUrl: input.destinationUrl,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
