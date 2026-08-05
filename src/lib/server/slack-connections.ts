import "server-only";

import type { PoolClient } from "pg";
import { appendAuditEvent } from "./audit";
import { getPool, withTransaction } from "./db";
import { getSentinelOpsPublicUrl, getServerEnv } from "./env";
import { ConflictError, NotFoundError } from "./errors";
import {
  decryptSlackWebhook,
  encryptSlackWebhook,
} from "./slack-credential-core";
import {
  selectSlackRoutes,
  shouldRevokeSlackWorkspaceToken,
  type SlackEventType,
  type SlackSeverity,
} from "./slack-routing-core";

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  team?: { id: string; name: string };
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
}

interface SlackConnectionRow {
  id: string;
  organization_id: string;
  team_id: string;
  team_name: string;
  channel_id: string;
  channel_name: string;
  webhook_ciphertext: Buffer;
  webhook_iv: Buffer;
  webhook_auth_tag: Buffer;
  access_token_ciphertext: Buffer | null;
  access_token_iv: Buffer | null;
  access_token_auth_tag: Buffer | null;
  status: "active" | "error" | "disconnected";
  last_delivery_at: Date | null;
  last_error: string | null;
  is_default: boolean;
  event_types: string[];
  minimum_severity: SlackSeverity;
  updated_at: Date;
}

function slackConfiguration() {
  const env = getServerEnv();
  if (
    !env.SLACK_CLIENT_ID ||
    !env.SLACK_CLIENT_SECRET ||
    !env.SLACK_CREDENTIAL_ENCRYPTION_KEY
  ) {
    throw new Error("Slack OAuth is not fully configured.");
  }
  return {
    clientId: env.SLACK_CLIENT_ID,
    clientSecret: env.SLACK_CLIENT_SECRET,
    encryptionKey: env.SLACK_CREDENTIAL_ENCRYPTION_KEY,
  };
}

export function slackOAuthRedirectUri() {
  return `${getSentinelOpsPublicUrl()}/api/v1/slack/connections/callback`;
}

export async function exchangeSlackOAuthCode(code: string) {
  const config = slackConfiguration();
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: slackOAuthRedirectUri(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json().catch(() => null)) as SlackOAuthResponse | null;
  if (
    !response.ok ||
    !payload?.ok ||
    !payload.access_token ||
    !payload.team ||
    !payload.incoming_webhook
  ) {
    throw new Error(`Slack authorization failed: ${payload?.error ?? `http_${response.status}`}`);
  }
  return payload as Required<
    Pick<SlackOAuthResponse, "access_token" | "team" | "incoming_webhook">
  >;
}

export async function saveSlackConnection(input: {
  organizationId: string;
  operatorId: string;
  operatorEmail: string;
  oauth: Required<
    Pick<SlackOAuthResponse, "access_token" | "team" | "incoming_webhook">
  >;
}) {
  const encryptionKey = slackConfiguration().encryptionKey;
  const encrypted = encryptSlackWebhook(
    input.oauth.incoming_webhook.url,
    encryptionKey,
  );
  const encryptedToken = encryptSlackWebhook(input.oauth.access_token, encryptionKey);
  return withTransaction(async (client) => {
    await client.query(
      `select pg_advisory_xact_lock(hashtextextended($1::text, 0))`,
      [input.organizationId],
    );
    const defaultResult = await client.query<{ available: boolean }>(
      `select not exists (
         select 1 from slack_connections where organization_id = $1 and is_default
       ) as available`,
      [input.organizationId],
    );
    const result = await client.query<{ id: string }>(
      `insert into slack_connections (
         organization_id, team_id, team_name, channel_id, channel_name,
         webhook_ciphertext, webhook_iv, webhook_auth_tag,
         access_token_ciphertext, access_token_iv, access_token_auth_tag, status,
         connected_by_operator_id, connected_by_email, is_default
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12, $13, $14)
       on conflict (organization_id, team_id, channel_id) do update set
         team_id = excluded.team_id,
         team_name = excluded.team_name,
         channel_id = excluded.channel_id,
         channel_name = excluded.channel_name,
         webhook_ciphertext = excluded.webhook_ciphertext,
         webhook_iv = excluded.webhook_iv,
         webhook_auth_tag = excluded.webhook_auth_tag,
         access_token_ciphertext = excluded.access_token_ciphertext,
         access_token_iv = excluded.access_token_iv,
         access_token_auth_tag = excluded.access_token_auth_tag,
         status = 'active',
         connected_by_operator_id = excluded.connected_by_operator_id,
         connected_by_email = excluded.connected_by_email,
         last_error = null,
         updated_at = now()
       returning id`,
      [
        input.organizationId,
        input.oauth.team.id,
        input.oauth.team.name,
        input.oauth.incoming_webhook.channel_id,
        input.oauth.incoming_webhook.channel,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
        encryptedToken.ciphertext,
        encryptedToken.iv,
        encryptedToken.authTag,
        input.operatorId,
        input.operatorEmail,
        defaultResult.rows[0]?.available ?? false,
      ],
    );
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "slack.connection_authorized",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: {
        connectionId: result.rows[0].id,
        teamId: input.oauth.team.id,
        teamName: input.oauth.team.name,
        channelId: input.oauth.incoming_webhook.channel_id,
        channelName: input.oauth.incoming_webhook.channel,
      },
    });
    return result.rows[0].id;
  });
}

export async function listOrganizationSlackConnections(organizationId: string) {
  const result = await getPool().query<SlackConnectionRow>(
    `select * from slack_connections
      where organization_id = $1
      order by is_default desc, team_name, channel_name`,
    [organizationId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    teamId: row.team_id,
    teamName: row.team_name,
    channelId: row.channel_id,
    channelName: row.channel_name,
    status: row.status,
    lastDeliveryAt: row.last_delivery_at?.toISOString() ?? null,
    lastError: row.last_error,
    isDefault: row.is_default,
    eventTypes: row.event_types,
    minimumSeverity: row.minimum_severity,
    updatedAt: row.updated_at.toISOString(),
  }));
}

export async function resolveSlackDeliveryTargets(input: {
  organizationId: string;
  eventType: SlackEventType;
  severity: SlackSeverity;
  connectionId?: string;
}) {
  const result = await getPool().query<SlackConnectionRow>(
    `select * from slack_connections
      where organization_id = $1 and status in ('active', 'error')
        and ($2::uuid is null or id = $2::uuid)
      order by is_default desc, created_at asc`,
    [input.organizationId, input.connectionId ?? null],
  );
  const selected = input.connectionId
    ? result.rows
    : selectSlackRoutes(
        result.rows.map((row) => ({
          id: row.id,
          isDefault: row.is_default,
          eventTypes: row.event_types,
          minimumSeverity: row.minimum_severity,
        })),
        input.eventType,
        input.severity,
      );
  const selectedIds = new Set(selected.map((route) => route.id));
  return result.rows.filter((row) => selectedIds.has(row.id)).map((row) => ({
      connectionId: row.id,
      webhookUrl: decryptSlackWebhook(
        {
          ciphertext: row.webhook_ciphertext,
          iv: row.webhook_iv,
          authTag: row.webhook_auth_tag,
        },
        slackConfiguration().encryptionKey,
      ),
      mode: "oauth" as const,
    }));
}

export async function recordSlackDelivery(input: {
  connectionId: string | null;
  delivered: boolean;
  reason: string;
}) {
  if (!input.connectionId) return;
  await getPool().query(
    `update slack_connections
        set status = $2,
            last_delivery_at = case when $2 = 'active' then now() else last_delivery_at end,
            last_error = case when $2 = 'active' then null else $3 end,
            updated_at = now()
      where id = $1`,
    [input.connectionId, input.delivered ? "active" : "error", input.reason],
  );
}

export async function disconnectSlackConnection(input: {
  organizationId: string;
  connectionId: string;
  operatorEmail: string;
}) {
  const connectionResult = await getPool().query<SlackConnectionRow>(
    `select * from slack_connections where organization_id = $1 and id = $2 limit 1`,
    [input.organizationId, input.connectionId],
  );
  const connection = connectionResult.rows[0];
  if (!connection) return false;
  const siblingResult = await getPool().query<{ count: string }>(
    `select count(*)::text as count
       from slack_connections
      where organization_id = $1 and team_id = $2 and id <> $3`,
    [input.organizationId, connection.team_id, input.connectionId],
  );
  const shouldRevokeWorkspaceToken = shouldRevokeSlackWorkspaceToken(
    Number(siblingResult.rows[0]?.count ?? 0),
  );
  if (
    shouldRevokeWorkspaceToken &&
    connection.access_token_ciphertext &&
    connection.access_token_iv &&
    connection.access_token_auth_tag
  ) {
    const token = decryptSlackWebhook(
      {
        ciphertext: connection.access_token_ciphertext,
        iv: connection.access_token_iv,
        authTag: connection.access_token_auth_tag,
      },
      slackConfiguration().encryptionKey,
    );
    const response = await fetch("https://slack.com/api/auth.revoke", {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(`Slack access could not be revoked: ${payload?.error ?? `http_${response.status}`}`);
    }
  }
  return withTransaction(async (client) => {
    await client.query(
      `select pg_advisory_xact_lock(hashtextextended($1::text, 0))`,
      [input.organizationId],
    );
    const removed = await client.query<{ id: string; team_id: string; channel_id: string; is_default: boolean }>(
      `delete from slack_connections
        where organization_id = $1 and id = $2
        returning id, team_id, channel_id, is_default`,
      [input.organizationId, input.connectionId],
    );
    if (!removed.rows[0]) return false;
    if (removed.rows[0].is_default) {
      await client.query(
        `update slack_connections set is_default = true, updated_at = now()
          where id = (
            select id from slack_connections
            where organization_id = $1
            order by created_at asc, id asc
            limit 1
          )`,
        [input.organizationId],
      );
    }
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "slack.connection_disconnected",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: {
        ...removed.rows[0],
        workspaceTokenRevoked: shouldRevokeWorkspaceToken,
      },
    });
    return true;
  });
}

export async function updateSlackConnectionRouting(input: {
  organizationId: string;
  connectionId: string;
  operatorEmail: string;
  isDefault: boolean;
  eventTypes: SlackEventType[];
  minimumSeverity: SlackSeverity;
}) {
  return withTransaction(async (client) => {
    await client.query(
      `select pg_advisory_xact_lock(hashtextextended($1::text, 0))`,
      [input.organizationId],
    );
    const current = await client.query<SlackConnectionRow>(
      `select * from slack_connections
        where organization_id = $1 and id = $2
        for update`,
      [input.organizationId, input.connectionId],
    );
    const row = current.rows[0];
    if (!row) throw new NotFoundError("Slack destination not found.");
    if (row.is_default && !input.isDefault) {
      throw new ConflictError("Choose another default destination before changing this route.");
    }
    if (input.isDefault) {
      await client.query(
        `update slack_connections
          set is_default = false, updated_at = now()
          where organization_id = $1 and id <> $2 and is_default`,
        [input.organizationId, input.connectionId],
      );
    }
    const updated = await client.query(
      `update slack_connections
        set is_default = $3,
            event_types = $4::text[],
            minimum_severity = $5,
            updated_at = now()
        where organization_id = $1 and id = $2
        returning id`,
      [
        input.organizationId,
        input.connectionId,
        input.isDefault,
        input.isDefault ? [] : input.eventTypes,
        input.minimumSeverity,
      ],
    );
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "slack.routing_updated",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: {
        connectionId: input.connectionId,
        isDefault: input.isDefault,
        eventTypes: input.isDefault ? [] : input.eventTypes,
        minimumSeverity: input.minimumSeverity,
      },
    });
    return Boolean(updated.rows[0]);
  });
}

export async function claimSlackOAuthState(
  client: PoolClient,
  stateHash: string,
) {
  const result = await client.query<{
    organization_id: string;
    operator_id: string;
    email: string;
  }>(
    `update slack_oauth_states oauth_state
        set consumed_at = now()
       from operators op
      where oauth_state.state_hash = $1
        and op.id = oauth_state.operator_id
        and op.organization_id = oauth_state.organization_id
        and op.status = 'active'
        and oauth_state.consumed_at is null
        and oauth_state.expires_at > now()
      returning oauth_state.organization_id, oauth_state.operator_id, op.email`,
    [stateHash],
  );
  return result.rows[0] ?? null;
}
