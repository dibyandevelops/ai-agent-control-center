import "server-only";

import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { appendAuditEvent } from "./audit";
import { getPool, withTransaction } from "./db";
import { getSentinelOpsPublicUrl } from "./env";
import { AuthenticationError, ConflictError, NotFoundError } from "./errors";
import {
  createScimBearerToken,
  emailMatchesAllowedDomains,
  hashScimBearerToken,
  normalizeAllowedDomains,
  scimTokenHint,
} from "./identity-core";
import { hashPassword } from "./password";
import type { OperatorRole } from "./operator-roles";

export interface IdentitySettings {
  allowedEmailDomains: string[];
  scimConfigured: boolean;
  scimTokenHint: string | null;
  scimTokenCreatedAt: string | null;
  lastScimSyncAt: string | null;
  sessionPolicy: { maxDurationMinutes: number; idleTimeoutMinutes: number };
  saml: { configured: boolean; enabled: boolean; idpEntityId: string | null; entryPoint: string | null; emailAttribute: string; metadataUrl: string | null };
}

interface IdentitySettingsRow {
  allowed_email_domains: string[];
  scim_token_hash: string | null;
  scim_token_hint: string | null;
  scim_token_created_at: Date | null;
  last_scim_sync_at: Date | null;
  saml_enabled: boolean;
  saml_idp_entity_id: string | null;
  saml_entry_point: string | null;
  saml_email_attribute: string;
  session_max_duration_minutes: number;
  session_idle_timeout_minutes: number;
}

function serializeSettings(row: IdentitySettingsRow | undefined, organizationId: string): IdentitySettings {
  return {
    allowedEmailDomains: row?.allowed_email_domains ?? [],
    scimConfigured: Boolean(row?.scim_token_hash),
    scimTokenHint: row?.scim_token_hint ?? null,
    scimTokenCreatedAt: row?.scim_token_created_at?.toISOString() ?? null,
    lastScimSyncAt: row?.last_scim_sync_at?.toISOString() ?? null,
    sessionPolicy: {
      maxDurationMinutes: row?.session_max_duration_minutes ?? 480,
      idleTimeoutMinutes: row?.session_idle_timeout_minutes ?? 60,
    },
    saml: {
      configured: Boolean(row?.saml_idp_entity_id && row.saml_entry_point), enabled: row?.saml_enabled ?? false,
      idpEntityId: row?.saml_idp_entity_id ?? null, entryPoint: row?.saml_entry_point ?? null,
      emailAttribute: row?.saml_email_attribute ?? "email",
      metadataUrl: row?.saml_idp_entity_id ? `${getSentinelOpsPublicUrl()}/api/v1/sso/saml/metadata/${organizationId}` : null,
    },
  };
}

export async function getOrganizationIdentitySettings(organizationId: string) {
  const result = await getPool().query<IdentitySettingsRow>(
    `select allowed_email_domains, scim_token_hash, scim_token_hint,
            scim_token_created_at, last_scim_sync_at, saml_enabled,
            saml_idp_entity_id, saml_entry_point, saml_email_attribute,
            session_max_duration_minutes, session_idle_timeout_minutes
       from organization_identity_settings
      where organization_id = $1`,
    [organizationId],
  );
  return serializeSettings(result.rows[0], organizationId);
}

export async function assertOrganizationEmailAllowed(organizationId: string, email: string) {
  const result = await getPool().query<{ allowed_email_domains: string[] }>(
    `select allowed_email_domains from organization_identity_settings
      where organization_id = $1`,
    [organizationId],
  );
  const domains = result.rows[0]?.allowed_email_domains ?? [];
  if (!emailMatchesAllowedDomains(email, domains)) {
    throw new ConflictError("This email does not match the organization's allowed email domains.");
  }
}

export async function updateAllowedEmailDomains(input: {
  organizationId: string;
  operatorId: string;
  operatorEmail: string;
  domains: string[];
}) {
  const domains = normalizeAllowedDomains(input.domains);
  return withTransaction(async (client) => {
    await client.query(
      `insert into organization_identity_settings (organization_id, allowed_email_domains)
       values ($1, $2::text[])
       on conflict (organization_id) do update set
         allowed_email_domains = excluded.allowed_email_domains,
         updated_at = now()`,
      [input.organizationId, domains],
    );
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "identity.allowed_domains_updated",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: { domains, operatorId: input.operatorId },
    });
    return { allowedEmailDomains: domains };
  });
}

export async function updateSessionPolicy(input: {
  organizationId: string;
  operatorId: string;
  operatorEmail: string;
  maxDurationMinutes: number;
  idleTimeoutMinutes: number;
}) {
  if (input.idleTimeoutMinutes > input.maxDurationMinutes) {
    throw new ConflictError("Idle timeout cannot exceed the maximum session duration.");
  }
  return withTransaction(async (client) => {
    await client.query(
      `insert into organization_identity_settings (
         organization_id, session_max_duration_minutes, session_idle_timeout_minutes
       ) values ($1, $2, $3)
       on conflict (organization_id) do update set
         session_max_duration_minutes = excluded.session_max_duration_minutes,
         session_idle_timeout_minutes = excluded.session_idle_timeout_minutes,
         updated_at = now()`,
      [input.organizationId, input.maxDurationMinutes, input.idleTimeoutMinutes],
    );
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "identity.session_policy_updated",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: {
        operatorId: input.operatorId,
        maxDurationMinutes: input.maxDurationMinutes,
        idleTimeoutMinutes: input.idleTimeoutMinutes,
      },
    });
    return {
      sessionPolicy: {
        maxDurationMinutes: input.maxDurationMinutes,
        idleTimeoutMinutes: input.idleTimeoutMinutes,
      },
    };
  });
}

export async function rotateOrganizationScimToken(input: {
  organizationId: string;
  operatorId: string;
  operatorEmail: string;
}) {
  const token = createScimBearerToken();
  await withTransaction(async (client) => {
    await client.query(
      `insert into organization_identity_settings (
         organization_id, scim_token_hash, scim_token_hint,
         scim_token_created_at, scim_token_created_by_operator_id
       ) values ($1, $2, $3, now(), $4)
       on conflict (organization_id) do update set
         scim_token_hash = excluded.scim_token_hash,
         scim_token_hint = excluded.scim_token_hint,
         scim_token_created_at = now(),
         scim_token_created_by_operator_id = excluded.scim_token_created_by_operator_id,
         updated_at = now()`,
      [input.organizationId, hashScimBearerToken(token), scimTokenHint(token), input.operatorId],
    );
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "identity.scim_token_rotated",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: { operatorId: input.operatorId, tokenHint: scimTokenHint(token) },
    });
  });
  return token;
}

export interface ScimIdentity {
  organizationId: string;
  organizationName: string;
}

export async function authenticateScimRequest(request: NextRequest): Promise<ScimIdentity> {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token?.startsWith("sos_scim_")) {
    throw new AuthenticationError("A valid SCIM bearer token is required.");
  }
  const result = await getPool().query<{
    organization_id: string;
    organization_name: string;
  }>(
    `select settings.organization_id, organizations.name as organization_name
       from organization_identity_settings settings
       join organizations on organizations.id = settings.organization_id
      where settings.scim_token_hash = $1`,
    [hashScimBearerToken(token)],
  );
  const row = result.rows[0];
  if (!row) throw new AuthenticationError("A valid SCIM bearer token is required.");
  return { organizationId: row.organization_id, organizationName: row.organization_name };
}

export interface ScimProvisionedUser {
  id: string;
  externalId: string | null;
  userName: string;
  displayName: string;
  role: OperatorRole;
  active: boolean;
  created: boolean;
}

export async function provisionScimUser(input: {
  organizationId: string;
  externalId: string | null;
  email: string;
  displayName: string;
  role: OperatorRole;
  active: boolean;
}) {
  const email = input.email.trim().toLowerCase();
  return withTransaction(async (client) => {
    const settingsResult = await client.query<{ allowed_email_domains: string[] }>(
      `select allowed_email_domains from organization_identity_settings
        where organization_id = $1`,
      [input.organizationId],
    );
    const domains = settingsResult.rows[0]?.allowed_email_domains ?? [];
    if (!emailMatchesAllowedDomains(email, domains)) {
      throw new ConflictError("The identity provider user does not match this organization's allowed email domains.");
    }
    const existing = await client.query<{
      id: string;
      external_identity_id: string | null;
    }>(
      `select id, external_identity_id from operators
        where organization_id = $1
          and (email = $2 or ($3::text is not null and external_identity_id = $3))
        order by case when external_identity_id = $3 then 0 else 1 end
        limit 1
        for update`,
      [input.organizationId, email, input.externalId],
    );
    const current = existing.rows[0];
    const status = input.active ? "active" : "disabled";
    let id: string;
    let created = false;
    if (current) {
      const updated = await client.query<{ id: string }>(
        `update operators
            set email = $3, display_name = $4, role = $5, status = $6,
                identity_source = 'scim', external_identity_id = $7,
                updated_at = now()
          where id = $1 and organization_id = $2
          returning id`,
        [current.id, input.organizationId, email, input.displayName, input.role, status, input.externalId],
      );
      id = updated.rows[0].id;
    } else {
      const generatedPasswordHash = await hashPassword(randomBytes(48).toString("base64url"));
      const inserted = await client.query<{ id: string }>(
        `insert into operators (
           organization_id, email, display_name, role, password_hash, status,
           password_change_required, identity_source, external_identity_id
         ) values ($1, $2, $3, $4, $5, $6, true, 'scim', $7)
         returning id`,
        [input.organizationId, email, input.displayName, input.role, generatedPasswordHash, status, input.externalId],
      );
      id = inserted.rows[0].id;
      created = true;
    }
    if (!input.active) {
      await client.query(
        `update operator_sessions set revoked_at = now()
          where operator_id = $1 and revoked_at is null`,
        [id],
      );
    }
    await client.query(
      `update organization_identity_settings
          set last_scim_sync_at = now(), updated_at = now()
        where organization_id = $1`,
      [input.organizationId],
    );
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: created ? "identity.scim_user_created" : "identity.scim_user_updated",
      actorType: "system",
      actorId: "scim",
      payload: { operatorId: id, email, externalId: input.externalId, role: input.role, active: input.active },
    });
    return { id, externalId: input.externalId, userName: email, displayName: input.displayName, role: input.role, active: input.active, created };
  });
}

export async function getScimUser(organizationId: string, id: string) {
  const result = await getPool().query<{
    id: string; external_identity_id: string | null; email: string; display_name: string;
    role: OperatorRole; status: "active" | "disabled";
  }>(
    `select id, external_identity_id, email, display_name, role, status
       from operators where organization_id = $1 and id = $2 and identity_source = 'scim'`,
    [organizationId, id],
  );
  const row = result.rows[0];
  if (!row) throw new NotFoundError("SCIM user not found.");
  return { id: row.id, externalId: row.external_identity_id, userName: row.email, displayName: row.display_name, role: row.role, active: row.status === "active", created: false } satisfies ScimProvisionedUser;
}
