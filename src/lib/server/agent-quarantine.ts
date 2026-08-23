import { withTransaction } from "./db";
import { appendAuditEvent } from "./audit";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { operatorCan, OperatorRole } from "./operator-roles";
import { AgentStatus } from "../types";

export interface AgentQuarantineResult {
  agent: {
    id: string;
    organizationId: string;
    externalId: string;
    name: string;
    status: AgentStatus;
    quarantinedAt: string | null;
    quarantinedBy: string | null;
    quarantineReason: string | null;
  };
  cancelledPendingApprovalsCount: number;
}

export async function quarantineAgent(
  organizationId: string,
  agentId: string,
  operator: { id: string; email: string; role: OperatorRole },
  reason: string,
): Promise<AgentQuarantineResult> {
  if (!operatorCan(operator.role, "approve") && !operatorCan(operator.role, "manage_policies")) {
    throw new ForbiddenError("Insufficient permissions to quarantine agents.");
  }

  const cleanReason = reason.trim();
  if (cleanReason.length < 3 || cleanReason.length > 500) {
    throw new ValidationError("Quarantine reason must be between 3 and 500 characters.");
  }

  return withTransaction(async (client) => {
    const agentResult = await client.query<{
      id: string;
      organization_id: string;
      external_id: string;
      name: string;
      status: AgentStatus;
      quarantined_at: Date | null;
      quarantined_by: string | null;
      quarantine_reason: string | null;
    }>(
      `select id, organization_id, external_id, name, status,
              quarantined_at, quarantined_by, quarantine_reason
         from agents
        where id = $1 and organization_id = $2
        for update`,
      [agentId, organizationId],
    );

    const agent = agentResult.rows[0];
    if (!agent) throw new NotFoundError("Agent not found.");

    // Update agent status to quarantined
    const updateResult = await client.query<{
      id: string;
      organization_id: string;
      external_id: string;
      name: string;
      status: AgentStatus;
      quarantined_at: Date | null;
      quarantined_by: string | null;
      quarantine_reason: string | null;
    }>(
      `update agents
          set status = 'quarantined',
              quarantined_at = now(),
              quarantined_by = $3,
              quarantine_reason = $4,
              updated_at = now()
        where id = $1 and organization_id = $2
        returning id, organization_id, external_id, name, status,
                  quarantined_at, quarantined_by, quarantine_reason`,
      [agentId, organizationId, operator.email, cleanReason],
    );

    const updatedAgent = updateResult.rows[0];

    // Automatically block all pending action requests in flight for this agent
    const blockReason = `Emergency Killswitch: Agent quarantined by ${operator.email}. Reason: ${cleanReason}`;
    const blockedRequests = await client.query<{ id: string }>(
      `update action_requests
          set decision_status = 'blocked',
              decision_reason = $1,
              decided_by = $2,
              decided_at = now()
        where agent_id = $3
          and organization_id = $4
          and decision_status = 'pending'
        returning id`,
      [blockReason, operator.email, agentId, organizationId],
    );

    const cancelledCount = blockedRequests.rows.length;

    await appendAuditEvent(client, {
      organizationId,
      requestId: null,
      eventType: "agent.quarantined",
      actorType: "human",
      actorId: operator.email,
      payload: {
        agentId: updatedAgent.id,
        agentName: updatedAgent.name,
        externalId: updatedAgent.external_id,
        reason: cleanReason,
        cancelledPendingApprovalsCount: cancelledCount,
        quarantinedAt: updatedAgent.quarantined_at?.toISOString(),
      },
    });

    return {
      agent: {
        id: updatedAgent.id,
        organizationId: updatedAgent.organization_id,
        externalId: updatedAgent.external_id,
        name: updatedAgent.name,
        status: updatedAgent.status,
        quarantinedAt: updatedAgent.quarantined_at ? updatedAgent.quarantined_at.toISOString() : null,
        quarantinedBy: updatedAgent.quarantined_by,
        quarantineReason: updatedAgent.quarantine_reason,
      },
      cancelledPendingApprovalsCount: cancelledCount,
    };
  });
}

export async function liftAgentQuarantine(
  organizationId: string,
  agentId: string,
  operator: { id: string; email: string; role: OperatorRole },
  reason: string,
): Promise<AgentQuarantineResult["agent"]> {
  if (!operatorCan(operator.role, "approve") && !operatorCan(operator.role, "manage_policies")) {
    throw new ForbiddenError("Insufficient permissions to lift agent quarantine.");
  }

  const cleanReason = reason.trim();
  if (cleanReason.length < 3 || cleanReason.length > 500) {
    throw new ValidationError("Justification reason must be between 3 and 500 characters.");
  }

  return withTransaction(async (client) => {
    const agentResult = await client.query<{
      id: string;
      organization_id: string;
      external_id: string;
      name: string;
      status: AgentStatus;
      quarantined_at: Date | null;
      quarantined_by: string | null;
      quarantine_reason: string | null;
    }>(
      `select id, organization_id, external_id, name, status,
              quarantined_at, quarantined_by, quarantine_reason
         from agents
        where id = $1 and organization_id = $2
        for update`,
      [agentId, organizationId],
    );

    const agent = agentResult.rows[0];
    if (!agent) throw new NotFoundError("Agent not found.");

    const updateResult = await client.query<{
      id: string;
      organization_id: string;
      external_id: string;
      name: string;
      status: AgentStatus;
      quarantined_at: Date | null;
      quarantined_by: string | null;
      quarantine_reason: string | null;
    }>(
      `update agents
          set status = 'healthy',
              quarantined_at = null,
              quarantined_by = null,
              quarantine_reason = null,
              updated_at = now()
        where id = $1 and organization_id = $2
        returning id, organization_id, external_id, name, status,
                  quarantined_at, quarantined_by, quarantine_reason`,
      [agentId, organizationId],
    );

    const updatedAgent = updateResult.rows[0];

    await appendAuditEvent(client, {
      organizationId,
      requestId: null,
      eventType: "agent.unquarantined",
      actorType: "human",
      actorId: operator.email,
      payload: {
        agentId: updatedAgent.id,
        agentName: updatedAgent.name,
        externalId: updatedAgent.external_id,
        liftReason: cleanReason,
        previousQuarantineReason: agent.quarantine_reason,
      },
    });

    return {
      id: updatedAgent.id,
      organizationId: updatedAgent.organization_id,
      externalId: updatedAgent.external_id,
      name: updatedAgent.name,
      status: updatedAgent.status,
      quarantinedAt: null,
      quarantinedBy: null,
      quarantineReason: null,
    };
  });
}
