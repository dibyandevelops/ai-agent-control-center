import { PoolClient } from "pg";
import { getPool, withTransaction } from "./db";
import { appendAuditEvent } from "./audit";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "./errors";
import { operatorCan, OperatorRole } from "./operator-roles";

export type DelegationStatus = "active" | "scheduled" | "revoked" | "expired";

export interface ApproverDelegation {
  id: string;
  organizationId: string;
  delegatorOperatorId: string;
  delegatorEmail: string;
  delegatorDisplayName: string;
  delegateeOperatorId: string;
  delegateeEmail: string;
  delegateeDisplayName: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  createdAt: string;
  isActive: boolean;
  status: DelegationStatus;
}

export interface CreateDelegationInput {
  delegateeOperatorId: string;
  reason: string;
  startsAt?: string;
  endsAt: string;
}

interface DelegationRow {
  id: string;
  organization_id: string;
  delegator_operator_id: string;
  delegator_email: string;
  delegator_display_name: string;
  delegatee_operator_id: string;
  delegatee_email: string;
  delegatee_display_name: string;
  reason: string;
  starts_at: Date;
  ends_at: Date;
  revoked_at: Date | null;
  created_at: Date;
}

function serializeDelegationRow(row: DelegationRow): ApproverDelegation {
  const now = Date.now();
  const starts = row.starts_at.getTime();
  const ends = row.ends_at.getTime();
  const isActive = row.revoked_at === null && starts <= now && ends > now;
  const status: DelegationStatus = row.revoked_at
    ? "revoked"
    : isActive
      ? "active"
      : starts > now
        ? "scheduled"
        : "expired";

  return {
    id: row.id,
    organizationId: row.organization_id,
    delegatorOperatorId: row.delegator_operator_id,
    delegatorEmail: row.delegator_email,
    delegatorDisplayName: row.delegator_display_name,
    delegateeOperatorId: row.delegatee_operator_id,
    delegateeEmail: row.delegatee_email,
    delegateeDisplayName: row.delegatee_display_name,
    reason: row.reason,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
    isActive,
    status,
  };
}

export async function createApproverDelegation(
  organizationId: string,
  delegator: { id: string; email: string; role: OperatorRole },
  input: CreateDelegationInput,
): Promise<ApproverDelegation> {
  if (!operatorCan(delegator.role, "approve")) {
    throw new ForbiddenError("Only operators with approval authority can create delegations.");
  }

  if (delegator.id === input.delegateeOperatorId) {
    throw new ValidationError("You cannot delegate approval authority to yourself.");
  }

  const cleanReason = input.reason.trim();
  if (cleanReason.length < 3 || cleanReason.length > 500) {
    throw new ValidationError("Delegation reason must be between 3 and 500 characters.");
  }

  const startsAtDate = input.startsAt ? new Date(input.startsAt) : new Date();
  const endsAtDate = new Date(input.endsAt);

  if (isNaN(startsAtDate.getTime()) || isNaN(endsAtDate.getTime())) {
    throw new ValidationError("Invalid start or end timestamp format.");
  }

  if (endsAtDate.getTime() <= startsAtDate.getTime()) {
    throw new ValidationError("Delegation end time must be after start time.");
  }

  const maxDurationMs = 90 * 24 * 60 * 60 * 1000; // 90 days max
  if (endsAtDate.getTime() - startsAtDate.getTime() > maxDurationMs) {
    throw new ValidationError("Delegations cannot exceed 90 continuous days.");
  }

  return withTransaction(async (client) => {
    // Verify delegatee eligibility
    const delegateeResult = await client.query<{
      id: string;
      email: string;
      display_name: string;
      role: OperatorRole;
      status: string;
    }>(
      `select id, email, display_name, role, status
         from operators
        where id = $1 and organization_id = $2
        limit 1`,
      [input.delegateeOperatorId, organizationId],
    );

    const delegatee = delegateeResult.rows[0];
    if (!delegatee || delegatee.status !== "active") {
      throw new NotFoundError("Delegatee operator was not found or is inactive.");
    }

    if (!operatorCan(delegatee.role, "approve")) {
      throw new ForbiddenError("Delegatee must have an active role with approval permissions.");
    }

    // Check for overlapping active delegation from same delegator to same delegatee
    const overlapResult = await client.query<{ id: string }>(
      `select id from approver_delegations
        where organization_id = $1
          and delegator_operator_id = $2
          and delegatee_operator_id = $3
          and revoked_at is null
          and starts_at < $5
          and ends_at > $4
        limit 1`,
      [organizationId, delegator.id, delegatee.id, startsAtDate, endsAtDate],
    );

    if (overlapResult.rows.length > 0) {
      throw new ConflictError(
        "An active delegation for this approver and delegatee already covers this time period.",
      );
    }

    const insertResult = await client.query<DelegationRow>(
      `insert into approver_delegations (
         organization_id, delegator_operator_id, delegatee_operator_id,
         reason, starts_at, ends_at
       ) values ($1, $2, $3, $4, $5, $6)
       returning
         id, organization_id, delegator_operator_id, delegatee_operator_id,
         reason, starts_at, ends_at, revoked_at, created_at,
         $7::text as delegator_email,
         (select display_name from operators where id = $2) as delegator_display_name,
         $8::text as delegatee_email,
         $9::text as delegatee_display_name`,
      [
        organizationId,
        delegator.id,
        delegatee.id,
        cleanReason,
        startsAtDate,
        endsAtDate,
        delegator.email,
        delegatee.email,
        delegatee.display_name,
      ],
    );

    const created = insertResult.rows[0];

    await appendAuditEvent(client, {
      organizationId,
      requestId: null,
      eventType: "approver_delegation.created",
      actorType: "human",
      actorId: delegator.email,
      payload: {
        delegationId: created.id,
        delegatorId: delegator.id,
        delegatorEmail: delegator.email,
        delegateeId: delegatee.id,
        delegateeEmail: delegatee.email,
        reason: cleanReason,
        startsAt: startsAtDate.toISOString(),
        endsAt: endsAtDate.toISOString(),
      },
    });

    return serializeDelegationRow(created);
  });
}

export async function revokeApproverDelegation(
  organizationId: string,
  operator: { id: string; email: string; role: OperatorRole },
  delegationId: string,
): Promise<ApproverDelegation> {
  return withTransaction(async (client) => {
    const existing = await client.query<DelegationRow>(
      `select d.*,
              op1.email as delegator_email, op1.display_name as delegator_display_name,
              op2.email as delegatee_email, op2.display_name as delegatee_display_name
         from approver_delegations d
         join operators op1 on op1.id = d.delegator_operator_id
         join operators op2 on op2.id = d.delegatee_operator_id
        where d.id = $1 and d.organization_id = $2
        for update`,
      [delegationId, organizationId],
    );

    const row = existing.rows[0];
    if (!row) throw new NotFoundError("Delegation not found.");
    if (row.revoked_at !== null) {
      throw new ConflictError("Delegation has already been revoked.");
    }

    const isAdmin = operatorCan(operator.role, "manage_operators");
    const isDelegator = operator.id === row.delegator_operator_id;
    const isDelegatee = operator.id === row.delegatee_operator_id;

    if (!isAdmin && !isDelegator && !isDelegatee) {
      throw new ForbiddenError("Only the delegator, delegatee, or an administrator can revoke this delegation.");
    }

    const updateResult = await client.query<DelegationRow>(
      `update approver_delegations
          set revoked_at = now()
        where id = $1 and organization_id = $2
        returning
          id, organization_id, delegator_operator_id, delegatee_operator_id,
          reason, starts_at, ends_at, revoked_at, created_at,
          $3::text as delegator_email, $4::text as delegator_display_name,
          $5::text as delegatee_email, $6::text as delegatee_display_name`,
      [
        delegationId,
        organizationId,
        row.delegator_email,
        row.delegator_display_name,
        row.delegatee_email,
        row.delegatee_display_name,
      ],
    );

    const revoked = updateResult.rows[0];

    await appendAuditEvent(client, {
      organizationId,
      requestId: null,
      eventType: "approver_delegation.revoked",
      actorType: "human",
      actorId: operator.email,
      payload: {
        delegationId: revoked.id,
        delegatorId: revoked.delegator_operator_id,
        delegateeId: revoked.delegatee_operator_id,
        revokedBy: operator.email,
      },
    });

    return serializeDelegationRow(revoked);
  });
}

export async function listApproverDelegations(
  organizationId: string,
): Promise<ApproverDelegation[]> {
  const result = await getPool().query<DelegationRow>(
    `select d.*,
            op1.email as delegator_email, op1.display_name as delegator_display_name,
            op2.email as delegatee_email, op2.display_name as delegatee_display_name
       from approver_delegations d
       join operators op1 on op1.id = d.delegator_operator_id
       join operators op2 on op2.id = d.delegatee_operator_id
      where d.organization_id = $1
      order by d.created_at desc
      limit 100`,
    [organizationId],
  );

  return result.rows.map(serializeDelegationRow);
}

/**
 * Checks transitive 4-eyes separation:
 * Ensures the reviewer is not the requester AND if acting as a delegatee,
 * the original delegator was also not the requester.
 */
export async function assertTransitiveFourEyes(
  client: PoolClient,
  organizationId: string,
  reviewerOperatorId: string,
  requestedByOperatorId: string | null,
  requestedByEmail: string,
): Promise<{ delegatedFrom: { id: string; email: string } | null }> {
  // Direct check
  if (requestedByOperatorId && reviewerOperatorId === requestedByOperatorId) {
    throw new ConflictError("Four-eyes violation: you cannot approve an action or policy change you requested.");
  }

  // Active delegations to this reviewer
  const delegations = await client.query<{
    delegator_operator_id: string;
    delegator_email: string;
  }>(
    `select delegator_operator_id, op.email as delegator_email
       from approver_delegations d
       join operators op on op.id = d.delegator_operator_id
      where d.organization_id = $1
        and d.delegatee_operator_id = $2
        and d.revoked_at is null
        and d.starts_at <= now()
        and d.ends_at > now()`,
    [organizationId, reviewerOperatorId],
  );

  for (const d of delegations.rows) {
    if (requestedByOperatorId && d.delegator_operator_id === requestedByOperatorId) {
      throw new ConflictError(
        "Four-eyes violation: you hold an active delegation from the operator who requested this action.",
      );
    }
    if (d.delegator_email.toLowerCase() === requestedByEmail.toLowerCase()) {
      throw new ConflictError(
        "Four-eyes violation: you hold an active delegation from the requester's email.",
      );
    }
  }

  const primaryDelegator = delegations.rows[0]
    ? {
        id: delegations.rows[0].delegator_operator_id,
        email: delegations.rows[0].delegator_email,
      }
    : null;

  return { delegatedFrom: primaryDelegator };
}
