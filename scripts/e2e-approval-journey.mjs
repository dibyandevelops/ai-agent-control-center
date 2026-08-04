import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { once } from "node:events";
import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";
import { promisify } from "node:util";
import { Pool } from "pg";

const scrypt = promisify(scryptCallback);
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");
const remoteBaseUrl = process.env.SENTINELOPS_E2E_BASE_URL?.replace(/\/+$/, "");
if (remoteBaseUrl) {
  const target = new URL(remoteBaseUrl);
  if (target.protocol !== "https:" && target.hostname !== "127.0.0.1" && target.hostname !== "localhost") {
    throw new Error("SENTINELOPS_E2E_BASE_URL must use HTTPS for a remote deployment.");
  }
}

const pool = new Pool({
  connectionString,
  max: 3,
  ssl:
    process.env.DB_SSL === "true" || process.env.DB_SSL === "1"
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
      : undefined,
});

const runId = randomUUID();
const organizationSlug = `sentinelops-e2e-${runId}`;
const operatorEmail = `admin-${runId}@sentinelops.test`;
const operatorPassword = `E2E-${randomBytes(18).toString("base64url")}!`;
const agentApiKey = `sop_live_${randomBytes(24).toString("base64url")}`;
let organizationId = null;
let server = null;

async function passwordHash(value) {
  const salt = randomBytes(16);
  const derived = await scrypt(value, salt, 64, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return [
    "scrypt",
    16_384,
    8,
    1,
    salt.toString("base64url"),
    Buffer.from(derived).toString("base64url"),
  ].join("$");
}

async function availablePort() {
  const listener = net.createServer();
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  assert(address && typeof address !== "string");
  const port = address.port;
  listener.close();
  await once(listener, "close");
  return port;
}

async function setupTenant() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const organization = await client.query(
      `
        insert into organizations (name, slug)
        values ('SentinelOps E2E Tenant', $1)
        returning id
      `,
      [organizationSlug],
    );
    organizationId = organization.rows[0].id;

    const operator = await client.query(
      `
        insert into operators (
          organization_id, email, display_name, role, password_hash,
          password_change_required, password_changed_at
        )
        values ($1, $2, 'E2E Administrator', 'admin', $3, false, now())
        returning id
      `,
      [organizationId, operatorEmail, await passwordHash(operatorPassword)],
    );

    await client.query(
      `
        insert into api_keys (organization_id, name, key_prefix, key_hash)
        values ($1, 'E2E Agent', $2, $3)
      `,
      [
        organizationId,
        agentApiKey.slice(0, 16),
        createHash("sha256").update(agentApiKey).digest("hex"),
      ],
    );

    const policy = await client.query(
      `
        insert into policies (
          organization_id, name, description, priority, effect, conditions
        )
        values ($1, 'Production approval gate',
                'Requires human approval for production releases.',
                10, 'approval', $2::jsonb)
        returning id
      `,
      [
        organizationId,
        JSON.stringify({
          all: [
            { field: "environment", operator: "eq", value: "production" },
            { field: "action", operator: "eq", value: "deploy.release" },
          ],
        }),
      ],
    );
    const version = await client.query(
      `
        insert into policy_versions (
          organization_id, policy_id, version_number, name, description,
          priority, effect, conditions, change_type,
          created_by_operator_id, created_by_email
        )
        values ($1, $2, 1, 'Production approval gate',
                'Requires human approval for production releases.',
                10, 'approval', $3::jsonb, 'created', $4, $5)
        returning id
      `,
      [
        organizationId,
        policy.rows[0].id,
        JSON.stringify({
          all: [
            { field: "environment", operator: "eq", value: "production" },
            { field: "action", operator: "eq", value: "deploy.release" },
          ],
        }),
        operator.rows[0].id,
        operatorEmail,
      ],
    );
    await client.query(
      "update policies set active_version_id = $2 where id = $1",
      [policy.rows[0].id, version.rows[0].id],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function startServer() {
  const port = await availablePort();
  const output = [];
  server = spawn("pnpm", ["exec", "next", "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr]) {
    stream.on("data", (chunk) => {
      output.push(String(chunk));
      if (output.length > 20) output.shift();
    });
  }
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`SentinelOps server exited early.\n${output.join("")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return baseUrl;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`SentinelOps server did not become ready.\n${output.join("")}`);
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function exerciseJourney(baseUrl) {
  const agentHeaders = {
    authorization: `Bearer ${agentApiKey}`,
    "content-type": "application/json",
  };
  const evaluationBody = {
    idempotencyKey: `enterprise-journey-${runId}`,
    agent: {
      externalId: `release-agent-${runId}`,
      name: "Enterprise Release Agent",
      ownerEmail: "platform@sentinelops.test",
      team: "Platform Engineering",
      provider: "OpenAI",
    },
    action: "deploy.release",
    resource: "sentinelops/platform@e2e",
    environment: "production",
    context: { changeTicket: "E2E-1001" },
  };

  const evaluated = await jsonRequest(`${baseUrl}/api/v1/actions/evaluate`, {
    method: "POST",
    headers: agentHeaders,
    body: JSON.stringify(evaluationBody),
  });
  assert.equal(
    evaluated.response.status,
    201,
    `Action evaluation failed: ${JSON.stringify(evaluated.payload)}`,
  );
  assert.equal(evaluated.payload.status, "pending");
  assert.equal(evaluated.payload.risk, "high");
  const requestId = evaluated.payload.requestId;
  assert.match(requestId, /^[0-9a-f-]{36}$/);

  const replayed = await jsonRequest(`${baseUrl}/api/v1/actions/evaluate`, {
    method: "POST",
    headers: agentHeaders,
    body: JSON.stringify(evaluationBody),
  });
  assert.equal(replayed.response.status, 200);
  assert.equal(replayed.payload.replayed, true);
  assert.equal(replayed.payload.requestId, requestId);

  const queued = await pool.query(
    `
      select count(*)::int as count
      from notification_outbox
      where organization_id = $1
        and event_type = 'action.approval_requested'
        and payload->>'requestId' = $2
    `,
    [organizationId, requestId],
  );
  assert.equal(queued.rows[0].count, 1);

  const login = await jsonRequest(`${baseUrl}/api/v1/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: operatorEmail, password: operatorPassword }),
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.payload.operator.role, "admin");
  const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
  assert(cookie, "Operator session cookie was not returned.");

  const approval = await jsonRequest(
    `${baseUrl}/api/v1/actions/${requestId}/decision`,
    {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        decision: "approved",
        reason: "E2E administrator verified the production change.",
      }),
    },
  );
  assert.equal(approval.response.status, 200);
  assert.equal(approval.payload.status, "approved");

  const executing = await jsonRequest(
    `${baseUrl}/api/v1/actions/${requestId}/outcome`,
    {
      method: "POST",
      headers: agentHeaders,
      body: JSON.stringify({
        status: "executing",
        summary: "E2E release execution started.",
      }),
    },
  );
  assert.equal(executing.response.status, 201);
  assert.equal(executing.payload.execution.status, "executing");

  const completed = await jsonRequest(
    `${baseUrl}/api/v1/actions/${requestId}/outcome`,
    {
      method: "POST",
      headers: agentHeaders,
      body: JSON.stringify({
        status: "succeeded",
        summary: "E2E release execution completed.",
        externalReference: "https://github.com/example/sentinelops/actions/runs/1001",
      }),
    },
  );
  assert.equal(completed.response.status, 201);
  assert.equal(completed.payload.execution.status, "succeeded");

  const detail = await jsonRequest(
    `${baseUrl}/api/v1/actions/${requestId}/details`,
    { headers: { cookie } },
  );
  assert.equal(detail.response.status, 200);
  assert.equal(detail.payload.decision.status, "approved");
  assert.equal(detail.payload.execution.status, "succeeded");
  assert.deepEqual(
    detail.payload.timeline.map((event) => event.eventType),
    [
      "action.evaluated",
      "action.approved",
      "action.execution_executing",
      "action.execution_succeeded",
    ],
  );

  const integrity = await jsonRequest(`${baseUrl}/api/v1/audit/integrity`, {
    headers: { cookie },
  });
  assert.equal(integrity.response.status, 200);
  assert.equal(integrity.payload.verified, true);
  assert.equal(integrity.payload.organizationsChecked, 1);

  return {
    requestId,
    auditEvents: integrity.payload.eventsChecked,
    notificationJobs: queued.rows[0].count,
  };
}

async function cleanup() {
  if (organizationId) {
    await pool.query(
      "update policies set active_version_id = null where organization_id = $1",
      [organizationId],
    ).catch(() => undefined);
    await pool.query("delete from organizations where id = $1", [organizationId]);
  }
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    const stopped = await Promise.race([
      once(server, "exit").then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    if (!stopped && server.exitCode === null) {
      server.kill("SIGKILL");
      await once(server, "exit");
    }
  }
  await pool.end();
}

try {
  await setupTenant();
  const baseUrl = remoteBaseUrl || await startServer();
  const result = await exerciseJourney(baseUrl);
  console.log(
    remoteBaseUrl
      ? `Remote enterprise approval journey passed against ${new URL(baseUrl).host}.`
      : "Enterprise approval journey passed.",
  );
  console.log(`Request: ${result.requestId}`);
  console.log(`Audit events verified: ${result.auditEvents}`);
  console.log(`Deduplicated notification jobs: ${result.notificationJobs}`);
} finally {
  await cleanup();
}
