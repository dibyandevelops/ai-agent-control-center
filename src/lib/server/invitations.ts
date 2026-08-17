import "server-only";

import { appendAuditEvent } from "./audit";
import { getPool, withTransaction } from "./db";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { assertOrganizationEmailAllowed } from "./identity-provisioning";
import { sendOperatorInvitationEmail } from "./invitation-email";
import {
  createInvitationToken,
  getInvitationStatus,
  hashInvitationToken,
  type InvitationStatus,
} from "./invitations-core";
import type { OperatorRole } from "./operator-roles";
import { hashPassword } from "./password";

export interface OperatorInvitation {
  id: string;
  organizationId: string;
  email: string;
  role: OperatorRole;
  status: InvitationStatus;
  invitedByOperatorId: string | null;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export async function inviteOperator(input: {
  organizationId: string;
  inviterId: string;
  inviterEmail: string;
  email: string;
  role: OperatorRole;
}) {
  const email = input.email.trim().toLowerCase();
  await assertOrganizationEmailAllowed(input.organizationId, email);

  const existingOperator = await getPool().query<{ id: string }>(
    `select id from operators where organization_id = $1 and email = $2 limit 1`,
    [input.organizationId, email],
  );
  if (existingOperator.rows[0]) {
    throw new ConflictError("An operator with this email address already exists.");
  }

  const { token, hash } = createInvitationToken();

  const invitation = await withTransaction(async (client) => {
    const orgResult = await client.query<{ name: string }>(
      `select name from organizations where id = $1`,
      [input.organizationId],
    );
    const orgName = orgResult.rows[0]?.name ?? "SentinelOps Workspace";

    // Clean up any stale unaccepted invite for this exact email & org
    await client.query(
      `update operator_invitations
          set revoked_at = now(), updated_at = now()
        where organization_id = $1 and email = $2 and accepted_at is null and revoked_at is null`,
      [input.organizationId, email],
    );

    const result = await client.query<{
      id: string;
      organization_id: string;
      email: string;
      role: OperatorRole;
      expires_at: Date;
      created_at: Date;
    }>(
      `insert into operator_invitations (
         organization_id, email, role, token_hash, invited_by_operator_id, expires_at
       ) values ($1, $2, $3, $4, $5, now() + interval '7 days')
       returning id, organization_id, email, role, expires_at, created_at`,
      [input.organizationId, email, input.role, hash, input.inviterId],
    );

    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "operator.invited",
      actorType: "human",
      actorId: input.inviterEmail,
      payload: {
        invitationId: result.rows[0].id,
        email,
        role: input.role,
        invitedByOperatorId: input.inviterId,
      },
    });

    return {
      id: result.rows[0].id,
      organizationId: result.rows[0].organization_id,
      organizationName: orgName,
      email: result.rows[0].email,
      role: result.rows[0].role,
      expiresAt: result.rows[0].expires_at.toISOString(),
      createdAt: result.rows[0].created_at.toISOString(),
    };
  });

  const delivery = await sendOperatorInvitationEmail({
    email,
    organizationName: invitation.organizationName,
    inviterEmail: input.inviterEmail,
    role: input.role,
    token,
  });

  return {
    ...invitation,
    delivered: delivery.delivered,
    rawToken: token,
  };
}

export async function listInvitations(organizationId: string): Promise<OperatorInvitation[]> {
  const result = await getPool().query<{
    id: string;
    organization_id: string;
    email: string;
    role: OperatorRole;
    invited_by_operator_id: string | null;
    expires_at: Date;
    accepted_at: Date | null;
    revoked_at: Date | null;
    created_at: Date;
  }>(
    `select id, organization_id, email, role, invited_by_operator_id,
            expires_at, accepted_at, revoked_at, created_at
       from operator_invitations
      where organization_id = $1
      order by created_at desc`,
    [organizationId],
  );

  return result.rows.map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    email: row.email,
    role: row.role,
    status: getInvitationStatus(row),
    invitedByOperatorId: row.invited_by_operator_id,
    expiresAt: row.expires_at.toISOString(),
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    revokedAt: row.revoked_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function resendInvitation(input: {
  organizationId: string;
  invitationId: string;
  operatorId: string;
  operatorEmail: string;
}) {
  const { token, hash } = createInvitationToken();

  const invitation = await withTransaction(async (client) => {
    const current = await client.query<{
      id: string;
      organization_id: string;
      email: string;
      role: OperatorRole;
      accepted_at: Date | null;
    }>(
      `select id, organization_id, email, role, accepted_at
         from operator_invitations
        where id = $1 and organization_id = $2
        for update`,
      [input.invitationId, input.organizationId],
    );
    const row = current.rows[0];
    if (!row) throw new NotFoundError("Invitation not found.");
    if (row.accepted_at) {
      throw new ConflictError("This invitation has already been accepted.");
    }

    const orgResult = await client.query<{ name: string }>(
      `select name from organizations where id = $1`,
      [input.organizationId],
    );
    const orgName = orgResult.rows[0]?.name ?? "SentinelOps Workspace";

    await client.query(
      `update operator_invitations
          set token_hash = $3,
              expires_at = now() + interval '7 days',
              revoked_at = null,
              updated_at = now()
        where id = $1 and organization_id = $2`,
      [input.invitationId, input.organizationId, hash],
    );

    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "operator.invitation_resent",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: {
        invitationId: input.invitationId,
        email: row.email,
        operatorId: input.operatorId,
      },
    });

    return {
      id: row.id,
      email: row.email,
      role: row.role,
      organizationName: orgName,
    };
  });

  const delivery = await sendOperatorInvitationEmail({
    email: invitation.email,
    organizationName: invitation.organizationName,
    inviterEmail: input.operatorEmail,
    role: invitation.role,
    token,
  });

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    delivered: delivery.delivered,
    rawToken: token,
  };
}

export async function revokeInvitation(input: {
  organizationId: string;
  invitationId: string;
  operatorId: string;
  operatorEmail: string;
}) {
  return withTransaction(async (client) => {
    const current = await client.query<{
      id: string;
      email: string;
      accepted_at: Date | null;
      revoked_at: Date | null;
    }>(
      `select id, email, accepted_at, revoked_at
         from operator_invitations
        where id = $1 and organization_id = $2
        for update`,
      [input.invitationId, input.organizationId],
    );
    const row = current.rows[0];
    if (!row) throw new NotFoundError("Invitation not found.");
    if (row.accepted_at) {
      throw new ConflictError("This invitation has already been accepted and cannot be revoked.");
    }
    if (row.revoked_at) {
      return { revoked: true, id: row.id };
    }

    await client.query(
      `update operator_invitations
          set revoked_at = now(), updated_at = now()
        where id = $1 and organization_id = $2`,
      [input.invitationId, input.organizationId],
    );

    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "operator.invitation_revoked",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: {
        invitationId: input.invitationId,
        email: row.email,
        operatorId: input.operatorId,
      },
    });

    return { revoked: true, id: row.id };
  });
}

export async function validateInvitationToken(token: string) {
  const hash = hashInvitationToken(token.trim());
  const result = await getPool().query<{
    id: string;
    organization_id: string;
    organization_name: string;
    email: string;
    role: OperatorRole;
    expires_at: Date;
    accepted_at: Date | null;
    revoked_at: Date | null;
  }>(
    `select inv.id, inv.organization_id, org.name as organization_name,
            inv.email, inv.role, inv.expires_at, inv.accepted_at, inv.revoked_at
       from operator_invitations inv
       join organizations org on org.id = inv.organization_id
      where inv.token_hash = $1
      limit 1`,
    [hash],
  );

  const row = result.rows[0];
  if (!row) {
    throw new NotFoundError("Invitation not found or token is invalid.");
  }
  const status = getInvitationStatus(row);
  if (status === "accepted") {
    throw new ConflictError("This invitation has already been accepted. Sign in instead.");
  }
  if (status === "revoked") {
    throw new ValidationError("This invitation has been revoked. Contact your workspace administrator.");
  }
  if (status === "expired") {
    throw new ValidationError("This invitation has expired. Contact your workspace administrator to resend it.");
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    email: row.email,
    role: row.role,
    expiresAt: row.expires_at.toISOString(),
  };
}

export async function acceptInvitation(input: {
  token: string;
  displayName: string;
  password: string;
}) {
  if (input.password.length < 12) {
    throw new ValidationError("Password must be at least 12 characters long.");
  }
  const hash = hashInvitationToken(input.token.trim());
  const passwordHash = await hashPassword(input.password);

  return withTransaction(async (client) => {
    const result = await client.query<{
      id: string;
      organization_id: string;
      organization_name: string;
      email: string;
      role: OperatorRole;
      expires_at: Date;
      accepted_at: Date | null;
      revoked_at: Date | null;
    }>(
      `select inv.id, inv.organization_id, org.name as organization_name,
              inv.email, inv.role, inv.expires_at, inv.accepted_at, inv.revoked_at
         from operator_invitations inv
         join organizations org on org.id = inv.organization_id
        where inv.token_hash = $1
        for update`,
      [hash],
    );

    const row = result.rows[0];
    if (!row) {
      throw new NotFoundError("Invitation not found or token is invalid.");
    }
    const status = getInvitationStatus(row);
    if (status === "accepted") {
      throw new ConflictError("This invitation has already been accepted. Sign in instead.");
    }
    if (status === "revoked") {
      throw new ValidationError("This invitation has been revoked. Contact your workspace administrator.");
    }
    if (status === "expired") {
      throw new ValidationError("This invitation has expired. Contact your workspace administrator to resend it.");
    }

    const existingOp = await client.query<{ id: string }>(
      `select id from operators where organization_id = $1 and email = $2 limit 1`,
      [row.organization_id, row.email],
    );
    if (existingOp.rows[0]) {
      throw new ConflictError("An account for this email already exists.");
    }

    const opResult = await client.query<{ id: string }>(
      `insert into operators (
         organization_id, email, display_name, role, password_hash, status, password_change_required
       ) values ($1, $2, $3, $4, $5, 'active', false)
       returning id`,
      [row.organization_id, row.email, input.displayName.trim(), row.role, passwordHash],
    );
    const operatorId = opResult.rows[0].id;

    await client.query(
      `update operator_invitations
          set accepted_at = now(), updated_at = now()
        where id = $1`,
      [row.id],
    );

    await appendAuditEvent(client, {
      organizationId: row.organization_id,
      requestId: null,
      eventType: "operator.invitation_accepted",
      actorType: "human",
      actorId: row.email,
      payload: {
        invitationId: row.id,
        operatorId,
        role: row.role,
      },
    });

    await appendAuditEvent(client, {
      organizationId: row.organization_id,
      requestId: null,
      eventType: "operator.provisioned",
      actorType: "human",
      actorId: row.email,
      payload: {
        operatorId,
        role: row.role,
        source: "invitation",
        status: "active",
      },
    });

    return {
      operatorId,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      email: row.email,
      displayName: input.displayName.trim(),
      role: row.role,
    };
  });
}
