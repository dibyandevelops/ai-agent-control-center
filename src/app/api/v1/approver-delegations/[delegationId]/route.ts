import { NextRequest, NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import { apiError } from "@/lib/server/http";
import { revokeApproverDelegation } from "@/lib/server/approver-delegation";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ delegationId: string }> },
) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json({ error: "Operator authentication required." }, { status: 401 });
    }

    const { delegationId } = await context.params;
    const revoked = await revokeApproverDelegation(
      operator.organizationId,
      operator,
      delegationId,
    );

    return NextResponse.json(revoked);
  } catch (error) {
    return apiError(error);
  }
}
