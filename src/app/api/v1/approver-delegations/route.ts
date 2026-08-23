import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import {
  createApproverDelegation,
  listApproverDelegations,
} from "@/lib/server/approver-delegation";

const createDelegationSchema = z.object({
  delegateeOperatorId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime(),
});

export async function GET() {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "read")) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
    }

    const delegations = await listApproverDelegations(operator.organizationId);
    return NextResponse.json({ delegations });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }
    if (!operatorCan(operator.role, "approve")) {
      return NextResponse.json(
        { error: "Approver or administrator role required to delegate authority." },
        { status: 403 },
      );
    }

    const body = await request.json();
    const input = createDelegationSchema.parse(body);

    const delegation = await createApproverDelegation(
      operator.organizationId,
      operator,
      input,
    );

    return NextResponse.json(delegation, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
