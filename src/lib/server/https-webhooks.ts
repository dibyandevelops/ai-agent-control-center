import "server-only";

import { randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { appendAuditEvent } from "./audit";
import { getPool, withTransaction } from "./db";
import { getServerEnv } from "./env";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import {
  assertPublicHttpsWebhookUrl,
  httpsWebhookEnvelope,
  httpsWebhookEventHeader,
  httpsWebhookIdHeader,
  httpsWebhookSecretPrefix,
  httpsWebhookSignatureHeader,
  httpsWebhookTimestampHeader,
  signHttpsWebhookBody,
} from "../https-webhook-core";
import { assertOrganizationLimit } from "./plan-limits";
import { decryptSlackWebhook, encryptSlackWebhook } from "./slack-credential-core";

const maxWebhookNameLength = 80;
const deliveryTimeoutMs = 8_000;

interface HttpsWebhookRow {
  id: string;
  organization_id: string;
  name: string;
  destination_url: string;
  secret_ciphertext: Buffer;
  secret_iv: Buffer;
  secret_auth_tag: Buffer;
  secret_prefix: string;
  enabled: boolean;
  last_delivered_at: Date | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  revoked_at: Date | null;
}

export interface HttpsWebhookSummary {
  id: string;
  name: string;
  destinationUrl: string;
  secretPrefix: string;
  enabled: boolean;
  lastDeliveredAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

function signingEncryptionKey() {
  const key = getServerEnv().SLACK_CREDENTIAL_ENCRYPTION_KEY;
  if (!key) {
    throw new ValidationError(
      "HTTPS webhook secrets require SLACK_CREDENTIAL_ENCRYPTION_KEY to be configured.",
    );
  }
  return key;
}

function generateSigningSecret() {
  return `${httpsWebhookSecretPrefix}${randomBytes(32).toString("base64url")}`;
}

async function publicDestinationUrl(rawUrl: string) {
  try {
    return await assertPublicHttpsWebhookUrl(rawUrl);
  } catch (error) {
    throw new ValidationError(
      error instanceof Error ? error.message : "Webhook URL is not allowed.",
    );
  }
}

function toSummary(row: HttpsWebhookRow): HttpsWebhookSummary {
  return {
    id: row.id,
    name: row.name,
    destinationUrl: row.destination_url,
    secretPrefix: row.secret_prefix,
    enabled: row.enabled,
    lastDeliveredAt: row.last_delivered_at?.toISOString() ?? null,
    lastError: row.last_error,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function decryptSigningSecret(
  row: Pick<HttpsWebhookRow, "secret_ciphertext" | "secret_iv" | "secret_auth_tag">,
) {
  return decryptSlackWebhook(
    {
      ciphertext: row.secret_ciphertext,
      iv: row.secret_iv,
      authTag: row.secret_auth_tag,
    },
    signingEncryptionKey(),
  );
}

export async function listOrganizationHttpsWebhooks(organizationId: string) {
  const result = await getPool().query<HttpsWebhookRow>(
    `select *
       from organization_https_webhooks
      where organization_id = $1
        and revoked_at is null
      order by created_at asc`,
    [organizationId],
  );
  return result.rows.map(toSummary);
}

export async function enqueueHttpsWebhookFanout(
  client: PoolClient,
  input: {
    organizationId: string;
    eventType: string;
    dedupeKey: string;
    payload: unknown;
  },
) {
  const destinations = await client.query<{ id: string }>(
    `select id
       from organization_https_webhooks
      where organization_id = $1
        and revoked_at is null
        and enabled = true`,
    [input.organizationId],
  );
  let inserted = 0;
  for (const destination of destinations.rows) {
    const result = await client.query<{ id: string }>(
      `insert into notification_outbox (
         organization_id, channel, event_type, dedupe_key, payload
       )
       values ($1, 'https', $2, $3, $4::jsonb)
       on conflict (channel, dedupe_key) do nothing
       returning id`,
      [
        input.organizationId,
        input.eventType,
        `https:${destination.id}:${input.dedupeKey}`,
        JSON.stringify({
          destinationId: destination.id,
          data: input.payload,
        }),
      ],
    );
    if (result.rows[0]) inserted += 1;
  }
  return inserted > 0;
}

async function loadWebhook(
  client: PoolClient,
  organizationId: string,
  webhookId: string,
) {
  const result = await client.query<HttpsWebhookRow>(
    `select *
       from organization_https_webhooks
      where id = $1
        and organization_id = $2
        and revoked_at is null
      limit 1`,
    [webhookId, organizationId],
  );
  const row = result.rows[0];
  if (!row) throw new NotFoundError("HTTPS webhook destination was not found.");
  return row;
}

async function deliverSignedWebhook(input: {
  webhook: HttpsWebhookRow;
  organizationId: string;
  eventType: string;
  deliveryId: string;
  data: unknown;
}) {
  await publicDestinationUrl(input.webhook.destination_url);
  const secret = decryptSigningSecret(input.webhook);
  const occurredAt = new Date().toISOString();
  const body = JSON.stringify(
    httpsWebhookEnvelope({
      deliveryId: input.deliveryId,
      organizationId: input.organizationId,
      eventType: input.eventType,
      occurredAt,
      data: input.data,
    }),
  );
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signHttpsWebhookBody({ secret, timestamp, body });
  const response = await fetch(input.webhook.destination_url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(deliveryTimeoutMs),
    headers: {
      "content-type": "application/json",
      "user-agent": "SentinelOps-Webhook/1.0",
      [httpsWebhookIdHeader]: input.deliveryId,
      [httpsWebhookTimestampHeader]: timestamp,
      [httpsWebhookSignatureHeader]: signature,
      [httpsWebhookEventHeader]: input.eventType,
    },
    body,
  });
  if (!response.ok) {
    throw new Error(`Destination responded with HTTP ${response.status}.`);
  }
}

async function recordDelivery(
  client: PoolClient,
  webhookId: string,
  outcome: { delivered: boolean; error: string | null },
) {
  await client.query(
    `update organization_https_webhooks
        set last_delivered_at = case when $2 then now() else last_delivered_at end,
            last_error = $3,
            updated_at = now()
      where id = $1`,
    [webhookId, outcome.delivered, outcome.error],
  );
}

export async function createOrganizationHttpsWebhook(input: {
  organizationId: string;
  operatorId: string;
  operatorEmail: string;
  name: string;
  destinationUrl: string;
}) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > maxWebhookNameLength) {
    throw new ValidationError("Webhook name must be between 2 and 80 characters.");
  }
  const destinationUrl = await publicDestinationUrl(input.destinationUrl);
  const secret = generateSigningSecret();
  const encrypted = encryptSlackWebhook(secret, signingEncryptionKey());

  return withTransaction(async (client) => {
    await assertOrganizationLimit(client, {
      organizationId: input.organizationId,
      resource: "https_webhooks",
    });
    const inserted = await client
      .query<HttpsWebhookRow>(
        `insert into organization_https_webhooks (
           organization_id, name, destination_url,
           secret_ciphertext, secret_iv, secret_auth_tag, secret_prefix,
           created_by_operator_id
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         returning *`,
        [
          input.organizationId,
          name,
          destinationUrl,
          encrypted.ciphertext,
          encrypted.iv,
          encrypted.authTag,
          secret.slice(0, 14),
          input.operatorId,
        ],
      )
      .catch((error: { code?: string }) => {
        if (error.code === "23505") {
          throw new ConflictError("This organization already has a webhook for that URL.");
        }
        throw error;
      });
    const row = inserted.rows[0];
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "https_webhook.created",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: {
        webhookId: row.id,
        name: row.name,
        destinationUrl: row.destination_url,
        secretPrefix: row.secret_prefix,
      },
    });
    return { webhook: toSummary(row), signingSecret: secret };
  });
}

export async function updateOrganizationHttpsWebhook(input: {
  organizationId: string;
  operatorEmail: string;
  webhookId: string;
  enabled: boolean;
}) {
  return withTransaction(async (client) => {
    const existing = await loadWebhook(client, input.organizationId, input.webhookId);
    const updated = await client.query<HttpsWebhookRow>(
      `update organization_https_webhooks
          set enabled = $3,
              updated_at = now()
        where id = $1 and organization_id = $2 and revoked_at is null
        returning *`,
      [input.webhookId, input.organizationId, input.enabled],
    );
    const row = updated.rows[0] ?? existing;
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: input.enabled ? "https_webhook.enabled" : "https_webhook.disabled",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: { webhookId: row.id, name: row.name, destinationUrl: row.destination_url },
    });
    return toSummary(row);
  });
}

export async function rotateOrganizationHttpsWebhook(input: {
  organizationId: string;
  operatorEmail: string;
  webhookId: string;
}) {
  const secret = generateSigningSecret();
  const encrypted = encryptSlackWebhook(secret, signingEncryptionKey());
  return withTransaction(async (client) => {
    await loadWebhook(client, input.organizationId, input.webhookId);
    const updated = await client.query<HttpsWebhookRow>(
      `update organization_https_webhooks
          set secret_ciphertext = $3,
              secret_iv = $4,
              secret_auth_tag = $5,
              secret_prefix = $6,
              updated_at = now()
        where id = $1 and organization_id = $2 and revoked_at is null
        returning *`,
      [
        input.webhookId,
        input.organizationId,
        encrypted.ciphertext,
        encrypted.iv,
        encrypted.authTag,
        secret.slice(0, 14),
      ],
    );
    const row = updated.rows[0];
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "https_webhook.secret_rotated",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: { webhookId: row.id, name: row.name, secretPrefix: row.secret_prefix },
    });
    return { webhook: toSummary(row), signingSecret: secret };
  });
}

export async function revokeOrganizationHttpsWebhook(input: {
  organizationId: string;
  operatorEmail: string;
  webhookId: string;
}) {
  return withTransaction(async (client) => {
    const existing = await loadWebhook(client, input.organizationId, input.webhookId);
    await client.query(
      `update organization_https_webhooks
          set enabled = false,
              revoked_at = now(),
              updated_at = now()
        where id = $1 and organization_id = $2 and revoked_at is null`,
      [input.webhookId, input.organizationId],
    );
    await appendAuditEvent(client, {
      organizationId: input.organizationId,
      requestId: null,
      eventType: "https_webhook.revoked",
      actorType: "human",
      actorId: input.operatorEmail,
      payload: {
        webhookId: existing.id,
        name: existing.name,
        destinationUrl: existing.destination_url,
      },
    });
    return { revoked: true };
  });
}

export async function testOrganizationHttpsWebhook(input: {
  organizationId: string;
  operatorEmail: string;
  webhookId: string;
}) {
  return withTransaction(async (client) => {
    const webhook = await loadWebhook(client, input.organizationId, input.webhookId);
    if (!webhook.enabled) {
      throw new ValidationError("Enable the webhook before sending a test delivery.");
    }
    const deliveryId = randomUUID();
    try {
      await deliverSignedWebhook({
        webhook,
        organizationId: input.organizationId,
        eventType: "https.webhook_tested",
        deliveryId,
        data: {
          message: "SentinelOps signed webhook test",
          requestedBy: input.operatorEmail,
        },
      });
      await recordDelivery(client, webhook.id, { delivered: true, error: null });
      await appendAuditEvent(client, {
        organizationId: input.organizationId,
        requestId: null,
        eventType: "https_webhook.test_delivered",
        actorType: "human",
        actorId: input.operatorEmail,
        payload: { webhookId: webhook.id, deliveryId, destinationUrl: webhook.destination_url },
      });
      return { delivered: true, deliveryId };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "delivery_failed";
      await recordDelivery(client, webhook.id, { delivered: false, error: reason });
      await appendAuditEvent(client, {
        organizationId: input.organizationId,
        requestId: null,
        eventType: "https_webhook.test_failed",
        actorType: "human",
        actorId: input.operatorEmail,
        payload: {
          webhookId: webhook.id,
          deliveryId,
          destinationUrl: webhook.destination_url,
          reason,
        },
      });
      throw new ValidationError(`Webhook test delivery failed: ${reason}`);
    }
  });
}

export async function deliverHttpsOutboxItem(input: {
  organizationId: string;
  eventType: string;
  payload: unknown;
}) {
  const parsed = input.payload as { destinationId?: string; data?: unknown };
  if (!parsed?.destinationId) {
    return { delivered: false, reason: "invalid_payload" };
  }
  return withTransaction(async (client) => {
    const result = await client.query<HttpsWebhookRow>(
      `select *
         from organization_https_webhooks
        where id = $1
          and organization_id = $2
        limit 1`,
      [parsed.destinationId, input.organizationId],
    );
    const webhook = result.rows[0];
    if (!webhook || webhook.revoked_at || !webhook.enabled) {
      return { delivered: true, reason: "destination_disabled" };
    }
    try {
      await deliverSignedWebhook({
        webhook,
        organizationId: input.organizationId,
        eventType: input.eventType,
        deliveryId: randomUUID(),
        data: parsed.data ?? input.payload,
      });
      await recordDelivery(client, webhook.id, { delivered: true, error: null });
      return { delivered: true, reason: "delivered" };
    } catch (error) {
      const reason = error instanceof Error ? error.message.slice(0, 500) : "delivery_failed";
      await recordDelivery(client, webhook.id, { delivered: false, error: reason });
      return { delivered: false, reason };
    }
  });
}
