import "server-only";

import { SAML, type CacheProvider, type Profile, ValidateInResponseTo } from "@node-saml/node-saml";
import { appendAuditEvent } from "./audit";
import { getPool, withTransaction } from "./db";
import { getSentinelOpsPublicUrl } from "./env";
import { AuthenticationError, ConflictError, NotFoundError } from "./errors";
import { assertOrganizationEmailAllowed } from "./identity-provisioning";
import {
  createSamlRelayState,
  hashSamlRelayState,
  normalizeSamlCertificate,
  parseSamlCertificateExpiry,
} from "./saml-core";

interface SamlRow {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  saml_enabled: boolean;
  saml_enforced: boolean;
  saml_idp_entity_id: string | null;
  saml_entry_point: string | null;
  saml_idp_certificate: string | null;
  saml_email_attribute: string;
  saml_cert_expires_at: Date | null;
}

function callbackUrl() {
  return `${getSentinelOpsPublicUrl()}/api/v1/sso/saml/callback`;
}

function issuer(organizationId: string) {
  return `${getSentinelOpsPublicUrl()}/api/v1/sso/saml/metadata/${organizationId}`;
}

async function getSamlRow(organizationId: string) {
  const result = await getPool().query<SamlRow>(
    `select settings.organization_id, organizations.name as organization_name, organizations.slug as organization_slug,
            settings.saml_enabled, settings.saml_enforced, settings.saml_idp_entity_id, settings.saml_entry_point,
            settings.saml_idp_certificate, settings.saml_email_attribute, settings.saml_cert_expires_at
       from organization_identity_settings settings
       join organizations on organizations.id = settings.organization_id
      where settings.organization_id = $1`,
    [organizationId],
  );
  return result.rows[0] ?? null;
}

function configured(row: SamlRow | null): row is SamlRow & {
  saml_idp_entity_id: string;
  saml_entry_point: string;
  saml_idp_certificate: string;
} {
  return Boolean(row?.saml_enabled && row.saml_idp_entity_id && row.saml_entry_point && row.saml_idp_certificate);
}

class PostgresSamlCache implements CacheProvider {
  constructor(private organizationId: string, private relayStateHash: string) {}
  async saveAsync(key: string, value: string) {
    await getPool().query(
      `insert into saml_login_requests (request_id, organization_id, relay_state_hash, value, expires_at)
       values ($1, $2, $3, $4, now() + interval '5 minutes')`,
      [key, this.organizationId, this.relayStateHash, value],
    );
    return { value, createdAt: Date.now() };
  }
  async getAsync(key: string) {
    const result = await getPool().query<{ value: string }>(
      `select value from saml_login_requests
        where request_id = $1 and organization_id = $2 and consumed_at is null and expires_at > now()`,
      [key, this.organizationId],
    );
    return result.rows[0]?.value ?? null;
  }
  async removeAsync(key: string | null) {
    if (!key) return null;
    const result = await getPool().query<{ value: string }>(
      `update saml_login_requests set consumed_at = now()
        where request_id = $1 and organization_id = $2 and consumed_at is null
        returning value`,
      [key, this.organizationId],
    );
    return result.rows[0]?.value ?? null;
  }
}

function samlFor(
  row: SamlRow & { saml_idp_entity_id: string; saml_entry_point: string; saml_idp_certificate: string },
  relayState: string,
) {
  return new SAML({
    issuer: issuer(row.organization_id),
    callbackUrl: callbackUrl(),
    entryPoint: row.saml_entry_point,
    idpCert: row.saml_idp_certificate,
    idpIssuer: row.saml_idp_entity_id,
    audience: issuer(row.organization_id),
    validateInResponseTo: ValidateInResponseTo.always,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: true,
    identifierFormat: null,
    cacheProvider: new PostgresSamlCache(row.organization_id, hashSamlRelayState(relayState)),
  });
}

export async function configureSaml(input: {
  organizationId: string;
  operatorId: string;
  operatorEmail: string;
  idpEntityId: string;
  entryPoint: string;
  idpCertificate: string;
  emailAttribute: string;
  enabled: boolean;
  enforced?: boolean;
}) {
  const entryPoint = new URL(input.entryPoint);
  if (entryPoint.protocol !== "https:") throw new Error("The IdP SSO URL must use HTTPS.");
  const certificate = normalizeSamlCertificate(input.idpCertificate);
  const certExpiresAt = parseSamlCertificateExpiry(certificate);

  return withTransaction(async (client) => {
    await client.query(
      `insert into organization_identity_settings (
         organization_id, saml_enabled, saml_enforced, saml_idp_entity_id, saml_entry_point, saml_idp_certificate,
         saml_email_attribute, saml_cert_expires_at, saml_configured_at, saml_configured_by_operator_id
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9)
       on conflict (organization_id) do update set
         saml_enabled = excluded.saml_enabled,
         saml_enforced = case when excluded.saml_enabled then coalesce(excluded.saml_enforced, organization_identity_settings.saml_enforced) else false end,
         saml_idp_entity_id = excluded.saml_idp_entity_id,
         saml_entry_point = excluded.saml_entry_point,
         saml_idp_certificate = excluded.saml_idp_certificate,
         saml_email_attribute = excluded.saml_email_attribute,
         saml_cert_expires_at = excluded.saml_cert_expires_at,
         saml_configured_at = now(),
         saml_configured_by_operator_id = excluded.saml_configured_by_operator_id,
         updated_at = now()`,
      [
        input.organizationId,
        input.enabled,
        input.enforced ?? false,
        input.idpEntityId.trim(),
        entryPoint.toString(),
        certificate,
        input.emailAttribute.trim() || "email",
        certExpiresAt,
        input.operatorId,
      ],
    );

    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "identity.saml_configured",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: {
        enabled: input.enabled,
        enforced: input.enforced ?? false,
        idpEntityId: input.idpEntityId.trim(),
        entryPoint: entryPoint.origin,
        emailAttribute: input.emailAttribute.trim() || "email",
        certExpiresAt: certExpiresAt?.toISOString() ?? null,
      },
    });

    return {
      configured: true,
      enabled: input.enabled,
      enforced: input.enforced ?? false,
      certExpiresAt: certExpiresAt?.toISOString() ?? null,
    };
  });
}

export async function disableSaml(input: {
  organizationId: string;
  operatorId: string;
  operatorEmail: string;
}) {
  return withTransaction(async (client) => {
    await client.query(
      `update organization_identity_settings
          set saml_enabled = false,
              saml_enforced = false,
              updated_at = now()
        where organization_id = $1`,
      [input.organizationId],
    );
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "identity.saml_disabled",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: { operatorId: input.operatorId },
    });
    return { enabled: false, enforced: false };
  });
}

export async function updateSamlEnforcement(input: {
  organizationId: string;
  operatorId: string;
  operatorEmail: string;
  enforced: boolean;
}) {
  return withTransaction(async (client) => {
    if (input.enforced) {
      const row = await getSamlRow(input.organizationId);
      if (!configured(row)) {
        throw new ConflictError("SAML SSO must be configured and enabled before enabling enforcement.");
      }
    }
    await client.query(
      `update organization_identity_settings
          set saml_enforced = $2,
              updated_at = now()
        where organization_id = $1`,
      [input.organizationId, input.enforced],
    );
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "identity.saml_enforcement_updated",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: { operatorId: input.operatorId, enforced: input.enforced },
    });
    return { samlEnforced: input.enforced };
  });
}

export async function startSamlLogin(email: string, host: string | undefined) {
  const normalized = email.trim().toLowerCase();
  const result = await getPool().query<SamlRow>(
    `select settings.organization_id, organizations.name as organization_name, organizations.slug as organization_slug,
            settings.saml_enabled, settings.saml_enforced, settings.saml_idp_entity_id, settings.saml_entry_point,
            settings.saml_idp_certificate, settings.saml_email_attribute, settings.saml_cert_expires_at
       from operators op join organizations on organizations.id = op.organization_id
       join organization_identity_settings settings on settings.organization_id = op.organization_id
      where op.email = $1 and op.status = 'active' and settings.saml_enabled
      limit 1`,
    [normalized],
  );
  const row = result.rows[0];
  if (!configured(row)) throw new AuthenticationError("SAML SSO is not configured for this account.");
  const relayState = createSamlRelayState();
  return samlFor(row, relayState).getAuthorizeUrlAsync(relayState, host, {});
}

export async function finishSamlLogin(input: { relayState: string; response: string }) {
  const pending = await getPool().query<{ organization_id: string }>(
    `select organization_id from saml_login_requests
      where relay_state_hash = $1 and consumed_at is null and expires_at > now() limit 1`,
    [hashSamlRelayState(input.relayState)],
  );
  const organizationId = pending.rows[0]?.organization_id;
  if (!organizationId) throw new AuthenticationError("This SAML sign-in is expired or has already been used.");
  const row = await getSamlRow(organizationId);
  if (!configured(row)) throw new AuthenticationError("SAML SSO is not configured for this organization.");
  const validated = await samlFor(row, input.relayState).validatePostResponseAsync({
    SAMLResponse: input.response,
    RelayState: input.relayState,
  });
  const profile = validated.profile as Profile | null;
  const candidate = profile?.[row.saml_email_attribute] ?? profile?.email ?? profile?.mail ?? profile?.["urn:oid:0.9.2342.19200300.100.1.3"];
  if (typeof candidate !== "string") throw new AuthenticationError("The SAML assertion did not include the configured email attribute.");
  await assertOrganizationEmailAllowed(organizationId, candidate);
  return { organizationId, email: candidate.trim().toLowerCase() };
}

export async function samlMetadata(organizationId: string) {
  const row = await getSamlRow(organizationId);
  if (!configured(row)) throw new NotFoundError("SAML metadata is not configured for this organization.");
  return samlFor(row, createSamlRelayState()).generateServiceProviderMetadata(null, null);
}
