import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import {
  disconnectSlackConnection,
  updateSlackConnectionRouting,
} from "@/lib/server/slack-connections";
import { slackEventTypes, slackSeverities } from "@/lib/server/slack-routing-core";

const connectionSchema = z.object({ connectionId: z.string().uuid() });
const routingSchema = connectionSchema.extend({
  isDefault: z.boolean(),
  eventTypes: z.array(z.enum(slackEventTypes)).max(slackEventTypes.length),
  minimumSeverity: z.enum(slackSeverities),
}).superRefine((value, context) => {
  if (!value.isDefault && value.eventTypes.length === 0) {
    context.addIssue({ code: "custom", path: ["eventTypes"], message: "Select at least one event type." });
  }
});

export async function DELETE(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "manage_integrations")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    const input = connectionSchema.parse(await request.json());
    const disconnected = await disconnectSlackConnection({
      organizationId: operator.organizationId,
      connectionId: input.connectionId,
      operatorEmail: operator.email,
    });
    return NextResponse.json({ disconnected });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "manage_integrations")) {
      return NextResponse.json({ error: "Admin role required." }, { status: 403 });
    }
    const input = routingSchema.parse(await request.json());
    await updateSlackConnectionRouting({
      organizationId: operator.organizationId,
      operatorEmail: operator.email,
      ...input,
    });
    return NextResponse.json({ updated: true });
  } catch (error) {
    return apiError(error);
  }
}
