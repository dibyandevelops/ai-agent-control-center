import { NextRequest, NextResponse } from "next/server";
import { getOperatorSession } from "@/lib/server/auth";
import type { ActionEvaluationInput, PolicyConditions } from "@/lib/server/contracts";
import { getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { operatorCan } from "@/lib/server/operator-roles";
import { policySimulationInputSchema } from "@/lib/server/policy-input";
import type { EvaluatedPolicy, PolicyEffect } from "@/lib/server/policy-engine";
import { simulatePolicyImpact } from "@/lib/server/policy-simulation";

export async function POST(request: NextRequest) {
  try {
    const operator = await getOperatorSession();
    if (!operator) {
      return NextResponse.json(
        { error: "Operator authentication required." },
        { status: 401 },
      );
    }
    if (!operatorCan(operator.role, "manage_policies")) {
      return NextResponse.json(
        { error: "Admin role required." },
        { status: 403 },
      );
    }

    const input = policySimulationInputSchema.parse(await request.json());
    const pool = getPool();
    const queryParams: unknown[] = [operator.organizationId, input.limit];
    let envClause = "";
    if (input.environment) {
      queryParams.push(input.environment);
      envClause = `and ar.environment = $${queryParams.length}`;
    }

    const [policiesResult, actionsResult] = await Promise.all([
      pool.query<{
        id: string;
        version_id: string;
        name: string;
        effect: PolicyEffect;
        priority: number;
        conditions: PolicyConditions;
      }>(
        `
          select
            p.id,
            pv.id as version_id,
            pv.name,
            pv.effect,
            pv.priority,
            pv.conditions
          from policies p
          join policy_versions pv on pv.id = p.active_version_id
          where p.organization_id = $1
            and p.enabled = true
          order by pv.priority asc, p.id asc
        `,
        [operator.organizationId],
      ),
      pool.query<{
        id: string;
        action: string;
        resource: string;
        environment: "development" | "staging" | "production";
        risk: "low" | "medium" | "high";
        context: ActionEvaluationInput["context"];
        requested_at: Date;
        agent_external_id: string;
        agent_name: string;
        owner_email: string;
        team: string;
        provider: string;
      }>(
        `
          select
            ar.id,
            ar.action,
            ar.resource,
            ar.environment,
            ar.risk,
            ar.context,
            ar.requested_at,
            a.external_id as agent_external_id,
            a.name as agent_name,
            a.owner_email,
            a.team,
            a.provider
          from action_requests ar
          join agents a on a.id = ar.agent_id
          where ar.organization_id = $1
            ${envClause}
          order by ar.requested_at desc, ar.id desc
          limit $2
        `,
        queryParams,
      ),
    ]);

    const candidate: EvaluatedPolicy = {
      id: input.policyId ?? "simulation-draft",
      name: input.name,
      effect: input.effect,
      priority: input.priority,
      conditions: input.conditions,
    };
    const currentPolicies: EvaluatedPolicy[] = policiesResult.rows.map((row) => ({
      id: row.id,
      versionId: row.version_id,
      name: row.name,
      effect: row.effect,
      priority: row.priority,
      conditions: row.conditions,
    }));
    const actions = actionsResult.rows.map((row) => ({
      requestId: row.id,
      agentName: row.agent_name,
      requestedAt: row.requested_at,
      input: {
        idempotencyKey: `simulation-${row.id}`,
        agent: {
          externalId: row.agent_external_id,
          name: row.agent_name,
          ownerEmail: row.owner_email,
          team: row.team,
          provider: row.provider,
        },
        action: row.action,
        resource: row.resource,
        environment: row.environment,
        riskHint: row.risk,
        context: row.context,
      },
    }));

    let syntheticResult: {
      action: string;
      resource: string;
      environment: string;
      baselineEffect: PolicyEffect;
      simulatedEffect: PolicyEffect;
      winningPolicyName: string;
      decisionChanged: boolean;
    } | null = null;

    if (input.syntheticAction) {
      const syntheticInput: ActionEvaluationInput = {
        idempotencyKey: "synthetic-dry-run",
        agent: {
          externalId: "synthetic-agent",
          name: "Synthetic Dry-Run Agent",
          ownerEmail: operator.email,
          team: "Security Simulation",
          provider: "synthetic",
        },
        action: input.syntheticAction.action,
        resource: input.syntheticAction.resource,
        environment: input.syntheticAction.environment,
        riskHint: input.syntheticAction.risk,
        context: input.syntheticAction.context,
      };

      const baselineEval = simulatePolicyImpact({
        candidate: currentPolicies[0] || candidate,
        currentPolicies,
        actions: [{ requestId: "synth", agentName: "Synthetic Agent", requestedAt: new Date(), input: syntheticInput }],
      });

      const candidateEval = simulatePolicyImpact({
        candidate,
        currentPolicies,
        actions: [{ requestId: "synth", agentName: "Synthetic Agent", requestedAt: new Date(), input: syntheticInput }],
      });

      const baselineRow = baselineEval.rows[0];
      const candidateRow = candidateEval.rows[0];

      if (candidateRow) {
        syntheticResult = {
          action: input.syntheticAction.action,
          resource: input.syntheticAction.resource,
          environment: input.syntheticAction.environment,
          baselineEffect: baselineRow?.simulatedEffect ?? "allow",
          simulatedEffect: candidateRow.simulatedEffect,
          winningPolicyName: candidateRow.winningPolicyName,
          decisionChanged: (baselineRow?.simulatedEffect ?? "allow") !== candidateRow.simulatedEffect,
        };
      }
    }

    return NextResponse.json(
      {
        ...simulatePolicyImpact({ candidate, currentPolicies, actions }),
        syntheticResult,
        simulatedAt: new Date().toISOString(),
        policyOrderBasis: "Current enabled policies and draft priority",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
