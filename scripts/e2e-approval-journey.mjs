import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
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
const expectTenantIsolationFailure =
  process.env.SENTINELOPS_E2E_EXPECT_TENANT_ISOLATION === "true";
const expectDryRun = process.env.SENTINELOPS_E2E_EXPECT_DRY_RUN === "true";
if (remoteBaseUrl) {
  const target = new URL(remoteBaseUrl);
  if (target.protocol !== "https:" && target.hostname !== "127.0.0.1" && target.hostname !== "localhost") {
    throw new Error("SENTINELOPS_E2E_BASE_URL must use HTTPS for a remote deployment.");
  }
}
if (expectTenantIsolationFailure && !remoteBaseUrl) {
  throw new Error(
    "SENTINELOPS_E2E_EXPECT_TENANT_ISOLATION requires SENTINELOPS_E2E_BASE_URL.",
  );
}
if (expectTenantIsolationFailure && expectDryRun) {
  throw new Error(
    "SENTINELOPS_E2E_EXPECT_TENANT_ISOLATION and SENTINELOPS_E2E_EXPECT_DRY_RUN cannot both be enabled.",
  );
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
const reviewerEmail = `reviewer-${runId}@sentinelops.test`;
const operatorPassword = `E2E-${randomBytes(18).toString("base64url")}!`;
const agentApiKey = `sop_live_${randomBytes(24).toString("base64url")}`;
const githubWebhookSecret = randomBytes(32).toString("hex");
const connectedRepository = remoteBaseUrl
  ? process.env.SENTINELOPS_E2E_REPOSITORY || "sentinelops/platform"
  : `sentinelops/e2e-${runId}`;
const githubInstallationId = Number.parseInt(
  createHash("sha256").update(runId).digest("hex").slice(0, 12),
  16,
);
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
        insert into operators (
          organization_id, email, display_name, role, password_hash,
          password_change_required, password_changed_at
        )
        values ($1, $2, 'E2E Independent Reviewer', 'admin', $3, false, now())
      `,
      [organizationId, reviewerEmail, await passwordHash(operatorPassword)],
    );

    await client.query(
      `
        insert into api_keys (
          organization_id, name, key_prefix, key_hash, expires_at
        )
        values ($1, 'E2E Agent', $2, $3, now() + interval '90 days')
      `,
      [
        organizationId,
        agentApiKey.slice(0, 16),
        createHash("sha256").update(agentApiKey).digest("hex"),
      ],
    );

    if (!remoteBaseUrl) {
      const installation = await client.query(
        `insert into github_app_installations (
           organization_id, github_installation_id, account_login, account_type,
           repository_selection, permissions, created_by_operator_id,
           created_by_email
         ) values ($1, $2, 'sentinelops-e2e', 'Organization', 'selected',
                   '{"contents":"write","metadata":"read"}'::jsonb, $3, $4)
         returning id`,
        [
          organizationId,
          githubInstallationId,
          operator.rows[0].id,
          operatorEmail,
        ],
      );
      await client.query(
        `insert into github_app_repositories (
           organization_id, installation_id, github_repository_id, full_name,
           owner_login, name, private, default_branch
         ) values ($1, $2, $3, $4, split_part($4, '/', 1),
                   split_part($4, '/', 2), true, 'main')`,
        [
          organizationId,
          installation.rows[0].id,
          Number.parseInt(createHash("sha256").update(`${runId}:repository`).digest("hex").slice(0, 12), 16),
          connectedRepository,
        ],
      );
    }

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
    env: {
      ...process.env,
      NODE_ENV: "production",
      GITHUB_WEBHOOK_SECRET: githubWebhookSecret,
    },
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

async function verifyExpiredAgentCredential(baseUrl) {
  await pool.query(
    `update api_keys
        set expires_at = now() - interval '1 second'
      where organization_id = $1
        and key_hash = $2`,
    [
      organizationId,
      createHash("sha256").update(agentApiKey).digest("hex"),
    ],
  );
  const rejected = await jsonRequest(`${baseUrl}/api/v1/actions/evaluate`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${agentApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      idempotencyKey: `expired-credential-${runId}`,
      agent: {
        externalId: `expired-agent-${runId}`,
        name: "Expired Credential Agent",
        ownerEmail: "platform@sentinelops.test",
        team: "Platform Engineering",
        provider: "SentinelOps E2E",
      },
      action: "system.health.read",
      resource: "sentinelops://expired-credential-check",
      environment: "development",
      context: { credentialExpirationTest: true },
    }),
  });
  assert.equal(rejected.response.status, 401);
  assert.equal(rejected.payload.error, "Invalid agent API key.");
}

async function exerciseJourney(baseUrl) {
  const agentHeaders = {
    authorization: `Bearer ${agentApiKey}`,
    "content-type": "application/json",
  };
  const login = await jsonRequest(`${baseUrl}/api/v1/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: operatorEmail, password: operatorPassword }),
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.payload.operator.role, "admin");
  const cookie = login.response.headers.get("set-cookie")?.split(";")[0];
  assert(cookie, "Operator session cookie was not returned.");
  const workspace = await jsonRequest(`${baseUrl}/api/v1/control-center`, {
    headers: { cookie },
  });
  assert.equal(workspace.response.status, 200);
  const identityDomains = await jsonRequest(`${baseUrl}/api/v1/identity/settings`, {
    method: "PATCH",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ allowedEmailDomains: ["sentinelops.test"] }),
  });
  assert.equal(identityDomains.response.status, 200);
  assert.deepEqual(identityDomains.payload.allowedEmailDomains, ["sentinelops.test"]);
  const scimTokenResponse = await jsonRequest(`${baseUrl}/api/v1/identity/scim-token`, {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(scimTokenResponse.response.status, 201);
  assert.match(scimTokenResponse.payload.token, /^sos_scim_/);
  const scimHeaders = {
    authorization: `Bearer ${scimTokenResponse.payload.token}`,
    "content-type": "application/scim+json",
  };
  const scimCapabilities = await jsonRequest(`${baseUrl}/api/v1/scim/v2/ServiceProviderConfig`, { headers: scimHeaders });
  assert.equal(scimCapabilities.response.status, 200);
  assert.equal(scimCapabilities.payload.patch.supported, true);
  const scimEmail = `scim-${runId}@sentinelops.test`;
  const scimCreated = await jsonRequest(`${baseUrl}/api/v1/scim/v2/Users`, {
    method: "POST",
    headers: scimHeaders,
    body: JSON.stringify({
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User", "urn:sentinelops:schemas:extension:identity:2.0:User"],
      externalId: `directory-${runId}`,
      userName: scimEmail,
      displayName: "SCIM E2E Auditor",
      active: true,
      "urn:sentinelops:schemas:extension:identity:2.0:User": { role: "auditor" },
    }),
  });
  assert.equal(scimCreated.response.status, 201, `SCIM user provisioning failed: ${JSON.stringify(scimCreated.payload)}`);
  assert.equal(scimCreated.payload.userName, scimEmail);
  assert.equal(scimCreated.payload.active, true);
  const scimListed = await jsonRequest(`${baseUrl}/api/v1/scim/v2/Users?filter=${encodeURIComponent(`userName eq "${scimEmail}"`)}`, { headers: scimHeaders });
  assert.equal(scimListed.response.status, 200);
  assert.equal(scimListed.payload.totalResults, 1);
  const scimDisabled = await jsonRequest(`${baseUrl}/api/v1/scim/v2/Users/${scimCreated.payload.id}`, {
    method: "PATCH",
    headers: scimHeaders,
    body: JSON.stringify({ schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"], Operations: [{ op: "replace", path: "active", value: false }] }),
  });
  assert.equal(scimDisabled.response.status, 200);
  assert.equal(scimDisabled.payload.active, false);
  const rejectedScimUser = await jsonRequest(`${baseUrl}/api/v1/scim/v2/Users`, {
    method: "POST",
    headers: scimHeaders,
    body: JSON.stringify({ userName: `outside-${runId}@outside.example`, displayName: "Rejected SCIM User", active: true }),
  });
  assert.equal(rejectedScimUser.response.status, 409);
  const releaseRepository = workspace.payload.integrations.find(
    (integration) => integration.name === "GitHub",
  )?.repository || "sentinelops/platform";
  const githubIntegration = workspace.payload.integrations.find(
    (integration) => integration.name === "GitHub",
  );
  if (!remoteBaseUrl) {
    assert.equal(githubIntegration.authenticationMode, "github_app");
    assert.equal(githubIntegration.githubConnections.length, 1);
    assert.equal(githubIntegration.githubConnections[0].repositories[0].fullName, releaseRepository);
  }
  const releaseTag = `e2e-${runId}`;
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
    resource: `${releaseRepository}@${releaseTag}`,
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

  let detail;
  const executionDeadline = Date.now() + 15_000;
  while (Date.now() < executionDeadline) {
    detail = await jsonRequest(
      `${baseUrl}/api/v1/actions/${requestId}/details`,
      { headers: { cookie } },
    );
    if (detail.payload.execution?.status === "succeeded") break;
    if (detail.payload.execution?.status === "failed") {
      if (expectTenantIsolationFailure) {
        assert.match(
          detail.payload.execution.summary,
          /^Repository .+ is not connected to this organization\.$/,
        );
        assert.deepEqual(
          detail.payload.timeline.map((event) => event.eventType),
          [
            "action.evaluated",
            "action.approved",
            "action.execution_executing",
            "action.execution_failed",
          ],
        );
        const integrity = await jsonRequest(`${baseUrl}/api/v1/audit/integrity`, {
          headers: { cookie },
        });
        assert.equal(integrity.response.status, 200);
        assert.equal(integrity.payload.verified, true);
        await verifyExpiredAgentCredential(baseUrl);
        return {
          requestId,
          auditEvents: integrity.payload.eventsChecked,
          notificationJobs: queued.rows[0].count,
          tenantIsolationVerified: true,
        };
      }
      throw new Error(
        `Automated release execution failed: ${detail.payload.execution.summary}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert(detail, "Automated execution details were not returned.");
  assert.equal(detail.response.status, 200);
  assert.equal(detail.payload.decision.status, "approved");
  assert.equal(detail.payload.execution.status, "succeeded");
  assert.match(
    detail.payload.execution.externalReference,
    remoteBaseUrl && !expectDryRun ? /^https:\/\/github\.com\// : /^dry-run:\/\//,
  );
  assert.deepEqual(
    detail.payload.timeline.map((event) => event.eventType),
    [
      "action.evaluated",
      "action.approved",
      "action.execution_executing",
      "action.execution_succeeded",
    ],
  );

  if (expectDryRun) {
    const integrity = await jsonRequest(`${baseUrl}/api/v1/audit/integrity`, {
      headers: { cookie },
    });
    assert.equal(integrity.response.status, 200);
    assert.equal(integrity.payload.verified, true);
    await verifyExpiredAgentCredential(baseUrl);
    return {
      requestId,
      auditEvents: integrity.payload.eventsChecked,
      notificationJobs: queued.rows[0].count,
      dryRunVerified: true,
    };
  }

  if (!remoteBaseUrl) {
    await pool.query(
      `
        update action_requests
        set execution_external_reference = 'https://github.com/sentinelops/platform/releases/tag/untagged-e2e'
        where id = $1 and organization_id = $2
      `,
      [requestId, organizationId],
    );
  }
  const governanceOperation = remoteBaseUrl ? "cancel" : "publish";
  const governanceRequested = await jsonRequest(
    `${baseUrl}/api/v1/actions/${requestId}/draft-governance`,
    {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        operation: governanceOperation,
        reason: `E2E ${governanceOperation} requires an independent administrator.`,
      }),
    },
  );
  assert.equal(
    governanceRequested.response.status,
    201,
    `Draft governance request failed: ${JSON.stringify(governanceRequested.payload)}`,
  );
  const governanceId = governanceRequested.payload.id;
  const governanceNotification = await pool.query(
    `
      select count(*)::int as count
      from notification_outbox
      where organization_id = $1
        and event_type = 'release.draft_governance_requested'
        and payload->>'governanceId' = $2
    `,
    [organizationId, governanceId],
  );
  assert.equal(governanceNotification.rows[0].count, 1);
  const governanceQueue = await jsonRequest(`${baseUrl}/api/v1/control-center`, {
    headers: { cookie },
  });
  assert.equal(governanceQueue.response.status, 200);
  assert.equal(
    governanceQueue.payload.releaseGovernance.find(
      (item) => item.id === governanceId,
    )?.status,
    "pending",
  );

  const selfApproval = await jsonRequest(
    `${baseUrl}/api/v1/release-governance/${governanceId}/decision`,
    {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        decision: "approved",
        reason: "The maker must not be allowed to approve this.",
      }),
    },
  );
  assert.equal(selfApproval.response.status, 409);
  assert.match(selfApproval.payload.error, /different administrator/i);

  const reviewerLogin = await jsonRequest(`${baseUrl}/api/v1/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: reviewerEmail, password: operatorPassword }),
  });
  assert.equal(reviewerLogin.response.status, 200);
  const reviewerCookie = reviewerLogin.response.headers.get("set-cookie")?.split(";")[0];
  assert(reviewerCookie, "Independent reviewer session cookie was not returned.");
  const governanceApproved = await jsonRequest(
    `${baseUrl}/api/v1/release-governance/${governanceId}/decision`,
    {
      method: "POST",
      headers: { cookie: reviewerCookie, "content-type": "application/json" },
      body: JSON.stringify({
        decision: "approved",
        reason: `Independent E2E reviewer approved ${governanceOperation} execution.`,
      }),
    },
  );
  assert.equal(governanceApproved.response.status, 200);
  assert.equal(governanceApproved.payload.status, "approved");

  let governanceDetail;
  const governanceDeadline = Date.now() + 15_000;
  while (Date.now() < governanceDeadline) {
    governanceDetail = await jsonRequest(
      `${baseUrl}/api/v1/actions/${requestId}/details`,
      { headers: { cookie: reviewerCookie } },
    );
    const governanceStatus = governanceDetail.payload.draftGovernance?.[0]?.status;
    if (governanceStatus === "succeeded" || governanceStatus === "failed") break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.equal(
    governanceDetail?.payload.draftGovernance?.[0]?.status,
    remoteBaseUrl ? "succeeded" : "failed",
  );
  assert.equal(
    governanceDetail.payload.timeline.filter(
      (event) => event.eventType === `release.draft_${governanceOperation}_approved`,
    ).length,
    1,
  );

  let driftIncidents = 0;
  let driftNotifications = 0;
  let containmentBlocks = 0;
  let containmentResolutions = 0;
  if (!remoteBaseUrl) {
    const driftPayload = JSON.stringify({
      action: "edited",
      release: {
        id: 1_234_567,
        tag_name: `e2e-${runId}`,
        draft: true,
        html_url: `https://github.com/${releaseRepository}/releases/tag/untagged-e2e`,
      },
      repository: { full_name: releaseRepository },
      sender: { login: "outside-release-manager" },
    });
    const deliveryId = randomUUID();
    const signature = `sha256=${createHmac("sha256", githubWebhookSecret)
      .update(driftPayload)
      .digest("hex")}`;
    const driftDelivery = await jsonRequest(`${baseUrl}/api/v1/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "release",
        "x-github-delivery": deliveryId,
        "x-hub-signature-256": signature,
      },
      body: driftPayload,
    });
    assert.equal(driftDelivery.response.status, 202);
    assert.equal(driftDelivery.payload.status, "drift");
    assert(driftDelivery.payload.incidentId);

    const duplicateDelivery = await jsonRequest(`${baseUrl}/api/v1/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "release",
        "x-github-delivery": deliveryId,
        "x-hub-signature-256": signature,
      },
      body: driftPayload,
    });
    assert.equal(duplicateDelivery.response.status, 200);
    assert.equal(duplicateDelivery.payload.status, "duplicate");

    const driftWorkspace = await jsonRequest(`${baseUrl}/api/v1/control-center`, {
      headers: { cookie },
    });
    const githubIntegration = driftWorkspace.payload.integrations.find(
      (integration) => integration.name === "GitHub",
    );
    assert.equal(githubIntegration.status, "attention");
    assert.equal(githubIntegration.driftIncidents.length, 1);
    driftIncidents = githubIntegration.driftIncidents.length;
    const driftAlert = await pool.query(
      `
        select count(*)::int as count
        from notification_outbox
        where organization_id = $1
          and event_type = 'github.release_drift_detected'
          and payload->>'incidentId' = $2
      `,
      [organizationId, driftDelivery.payload.incidentId],
    );
    assert.equal(driftAlert.rows[0].count, 1);
    driftNotifications = driftAlert.rows[0].count;

    const acknowledged = await jsonRequest(
      `${baseUrl}/api/v1/github-drift/${driftDelivery.payload.incidentId}/acknowledge`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ note: "E2E administrator opened an investigation." }),
      },
    );
    assert.equal(acknowledged.response.status, 200);
    assert.equal(acknowledged.payload.status, "acknowledged");
    const driftDetail = await jsonRequest(
      `${baseUrl}/api/v1/actions/${requestId}/details`,
      { headers: { cookie } },
    );
    assert.equal(
      driftDetail.payload.timeline.filter(
        (event) => event.eventType === "github.release_drift_detected",
      ).length,
      1,
    );
    assert.equal(
      driftDetail.payload.timeline.filter(
        (event) => event.eventType === "github.release_drift_acknowledged",
      ).length,
      1,
    );

    const containmentTag = `e2e-containment-${runId}`;
    const containmentResource = `${releaseRepository}@${containmentTag}`;
    const containmentAction = await pool.query(
      `
        insert into action_requests (
          organization_id, agent_id, policy_id, policy_version_id,
          idempotency_key, action, resource, environment, risk, context,
          decision_status, decision_reason, decided_by, decided_at,
          execution_status, execution_started_at, execution_completed_at,
          execution_external_reference, execution_summary,
          execution_attempt_count
        )
        select organization_id, agent_id, policy_id, policy_version_id,
               $2, action, $3, environment, risk, context,
               'approved', 'E2E containment fixture approved.',
               'e2e-containment-fixture', now(),
               'succeeded', now(), now(),
               'https://github.com/sentinelops/platform/releases/tag/untagged-containment',
               'E2E containment fixture created.', 1
        from action_requests
        where id = $1 and organization_id = $4
        returning id
      `,
      [
        requestId,
        `enterprise-containment-${runId}`,
        containmentResource,
        organizationId,
      ],
    );
    const containmentRequestId = containmentAction.rows[0].id;
    const requestContainedGovernance = () => jsonRequest(
      `${baseUrl}/api/v1/actions/${containmentRequestId}/draft-governance`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          operation: "publish",
          reason: "E2E publish request must respect critical containment.",
        }),
      },
    );
    const pendingBeforeContainment = await requestContainedGovernance();
    assert.equal(pendingBeforeContainment.response.status, 201);
    const containedGovernanceId = pendingBeforeContainment.payload.id;
    const approveContainedGovernance = () => jsonRequest(
      `${baseUrl}/api/v1/release-governance/${containedGovernanceId}/decision`,
      {
        method: "POST",
        headers: { cookie: reviewerCookie, "content-type": "application/json" },
        body: JSON.stringify({
          decision: "approved",
          reason: "E2E reviewer validates containment before execution.",
        }),
      },
    );
    const containmentPayload = JSON.stringify({
      action: "published",
      release: {
        id: 2_345_678,
        tag_name: containmentTag,
        draft: false,
        html_url: `https://github.com/${releaseRepository}/releases/tag/${containmentTag}`,
      },
      repository: { full_name: releaseRepository },
      sender: { login: "outside-release-manager" },
    });
    const containmentSignature = `sha256=${createHmac("sha256", githubWebhookSecret)
      .update(containmentPayload)
      .digest("hex")}`;
    const containmentDelivery = await jsonRequest(`${baseUrl}/api/v1/webhooks/github`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "release",
        "x-github-delivery": randomUUID(),
        "x-hub-signature-256": containmentSignature,
      },
      body: containmentPayload,
    });
    assert.equal(containmentDelivery.response.status, 202);
    assert.equal(containmentDelivery.payload.status, "drift");

    const blockedBeforeAcknowledgment = await requestContainedGovernance();
    assert.equal(blockedBeforeAcknowledgment.response.status, 409);
    assert.match(blockedBeforeAcknowledgment.payload.error, /frozen by critical GitHub incident/i);
    containmentBlocks += 1;
    const approvalBlockedBeforeAcknowledgment = await approveContainedGovernance();
    assert.equal(approvalBlockedBeforeAcknowledgment.response.status, 409);
    assert.match(approvalBlockedBeforeAcknowledgment.payload.error, /frozen by critical GitHub incident/i);
    containmentBlocks += 1;

    const containmentAcknowledged = await jsonRequest(
      `${baseUrl}/api/v1/github-drift/${containmentDelivery.payload.incidentId}/acknowledge`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ note: "E2E administrator started containment investigation." }),
      },
    );
    assert.equal(containmentAcknowledged.response.status, 200);
    assert.equal(containmentAcknowledged.payload.containmentActive, true);
    const blockedAfterAcknowledgment = await requestContainedGovernance();
    assert.equal(blockedAfterAcknowledgment.response.status, 409);
    assert.match(blockedAfterAcknowledgment.payload.error, /frozen by critical GitHub incident/i);
    containmentBlocks += 1;
    const approvalBlockedAfterAcknowledgment = await approveContainedGovernance();
    assert.equal(approvalBlockedAfterAcknowledgment.response.status, 409);
    assert.match(approvalBlockedAfterAcknowledgment.payload.error, /frozen by critical GitHub incident/i);
    containmentBlocks += 1;

    const containmentWorkspace = await jsonRequest(`${baseUrl}/api/v1/control-center`, {
      headers: { cookie },
    });
    const containedGitHub = containmentWorkspace.payload.integrations.find(
      (integration) => integration.name === "GitHub",
    );
    assert.match(containedGitHub.mode, /Containment active/i);
    assert.equal(
      containedGitHub.driftIncidents.find(
        (incident) => incident.id === containmentDelivery.payload.incidentId,
      )?.status,
      "acknowledged",
    );

    const containmentResolved = await jsonRequest(
      `${baseUrl}/api/v1/github-drift/${containmentDelivery.payload.incidentId}/resolve`,
      {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({
          note: "E2E investigation confirmed the target is safe and access was remediated.",
        }),
      },
    );
    assert.equal(containmentResolved.response.status, 200);
    assert.equal(containmentResolved.payload.status, "resolved");
    assert.equal(containmentResolved.payload.containmentLifted, true);
    containmentResolutions += 1;

    const governanceAfterResolution = await approveContainedGovernance();
    assert.equal(governanceAfterResolution.response.status, 200);
    assert.equal(governanceAfterResolution.payload.status, "approved");
    const containmentDetail = await jsonRequest(
      `${baseUrl}/api/v1/actions/${containmentRequestId}/details`,
      { headers: { cookie } },
    );
    assert.equal(
      containmentDetail.payload.timeline.filter(
        (event) => event.eventType === "github.release_containment_activated",
      ).length,
      1,
    );
    assert.equal(
      containmentDetail.payload.timeline.filter(
        (event) => event.eventType === "github.release_containment_resolved",
      ).length,
      1,
    );
  }
  assert.equal(
    governanceDetail.payload.timeline.filter(
      (event) => event.eventType === `release.draft_${governanceOperation}_executing`,
    ).length,
    1,
  );

  if (!remoteBaseUrl) {
    const governanceRetried = await jsonRequest(
      `${baseUrl}/api/v1/release-governance/${governanceId}/retry`,
      { method: "POST", headers: { cookie } },
    );
    assert.equal(
      governanceRetried.response.status,
      202,
      `Governance retry failed: ${JSON.stringify(governanceRetried.payload)}`,
    );

    let retriedGovernance;
    const governanceRetryDeadline = Date.now() + 15_000;
    while (Date.now() < governanceRetryDeadline) {
      const queue = await jsonRequest(`${baseUrl}/api/v1/control-center`, {
        headers: { cookie },
      });
      retriedGovernance = queue.payload.releaseGovernance.find(
        (item) => item.id === governanceId,
      );
      if (
        retriedGovernance?.status === "failed" &&
        retriedGovernance.executionAttemptCount >= 2
      ) break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.equal(retriedGovernance?.status, "failed");
    assert.equal(retriedGovernance?.executionAttemptCount, 2);
    const retriedGovernanceDetail = await jsonRequest(
      `${baseUrl}/api/v1/actions/${requestId}/details`,
      { headers: { cookie } },
    );
    assert.equal(
      retriedGovernanceDetail.payload.timeline.filter(
        (event) => event.eventType === `release.draft_${governanceOperation}_retry_requested`,
      ).length,
      1,
    );
  }

  let failureAlerts = 0;
  if (!remoteBaseUrl) {
  const failedEvaluationBody = {
    ...evaluationBody,
    idempotencyKey: `enterprise-retry-${runId}`,
    resource: "malformed-release-target",
    context: { changeTicket: "E2E-RETRY-1002" },
  };
  const failedEvaluation = await jsonRequest(
    `${baseUrl}/api/v1/actions/evaluate`,
    {
      method: "POST",
      headers: agentHeaders,
      body: JSON.stringify(failedEvaluationBody),
    },
  );
  assert.equal(failedEvaluation.response.status, 201);
  const failedRequestId = failedEvaluation.payload.requestId;
  const failedApproval = await jsonRequest(
    `${baseUrl}/api/v1/actions/${failedRequestId}/decision`,
    {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        decision: "approved",
        reason: "E2E administrator approved the retry scenario.",
      }),
    },
  );
  assert.equal(failedApproval.response.status, 200);

  let failedDetail;
  const failureDeadline = Date.now() + 15_000;
  while (Date.now() < failureDeadline) {
    failedDetail = await jsonRequest(
      `${baseUrl}/api/v1/actions/${failedRequestId}/details`,
      { headers: { cookie } },
    );
    if (failedDetail.payload.execution?.status === "failed") break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.equal(failedDetail?.payload.execution?.status, "failed");
  assert.equal(
    failedDetail.payload.execution.errorCode,
    "AUTOMATED_RELEASE_EXECUTION_FAILED",
  );
  const failureAlert = await pool.query(
    `
      select count(*)::int as count
      from notification_outbox
      where organization_id = $1
        and event_type = 'action.execution_failed'
        and payload->>'requestId' = $2
    `,
    [organizationId, failedRequestId],
  );
  assert.equal(failureAlert.rows[0].count, 1);
  failureAlerts = failureAlert.rows[0].count;

  // Simulate remediation of the transient release target before an operator retry.
  await pool.query(
    "update action_requests set resource = $2 where id = $1 and organization_id = $3",
    [failedRequestId, `${releaseRepository}@e2e-retry-${runId}`, organizationId],
  );
  const retried = await jsonRequest(
    `${baseUrl}/api/v1/actions/${failedRequestId}/execution/retry`,
    { method: "POST", headers: { cookie } },
  );
  assert.equal(
    retried.response.status,
    202,
    `Execution retry failed: ${JSON.stringify(retried.payload)}`,
  );

  let retriedDetail;
  const retryDeadline = Date.now() + 15_000;
  while (Date.now() < retryDeadline) {
    retriedDetail = await jsonRequest(
      `${baseUrl}/api/v1/actions/${failedRequestId}/details`,
      { headers: { cookie } },
    );
    if (retriedDetail.payload.execution?.status === "succeeded") break;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.equal(retriedDetail?.payload.execution?.status, "succeeded");
  assert.equal(
    retriedDetail.payload.timeline.filter(
      (event) => event.eventType === "action.execution_retry_requested",
    ).length,
    1,
  );
  assert.equal(
    retriedDetail.payload.timeline.filter(
      (event) => event.eventType === "action.execution_executing",
    ).length,
    2,
  );
  }

  let lifecycleEvents = 0;
  let lifecycleAlerts = 0;
  if (!remoteBaseUrl) {
    const lifecycleRepository = `sentinelops/lifecycle-${runId}`;
    const installation = {
      id: githubInstallationId,
      account: { login: "sentinelops-e2e", type: "Organization" },
      repository_selection: "selected",
      permissions: { contents: "write", metadata: "read" },
      suspended_at: null,
    };
    const sendLifecycle = async (eventName, payload, deliveryId = randomUUID()) => {
      const body = JSON.stringify(payload);
      const signature = `sha256=${createHmac("sha256", githubWebhookSecret)
        .update(body)
        .digest("hex")}`;
      return jsonRequest(`${baseUrl}/api/v1/webhooks/github`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-github-event": eventName,
          "x-github-delivery": deliveryId,
          "x-hub-signature-256": signature,
        },
        body,
      });
    };

    const repositoryDeliveryId = randomUUID();
    const repositoryAddedPayload = {
      action: "added",
      installation,
      repository_selection: "selected",
      repositories_added: [{
        id: Number.parseInt(
          createHash("sha256").update(`${runId}:lifecycle`).digest("hex").slice(0, 12),
          16,
        ),
        full_name: lifecycleRepository,
        name: lifecycleRepository.split("/")[1],
        private: true,
        default_branch: "main",
        owner: { login: "sentinelops" },
      }],
      repositories_removed: [],
      sender: { login: "github-installation-owner" },
    };
    const repositoryAdded = await sendLifecycle(
      "installation_repositories",
      repositoryAddedPayload,
      repositoryDeliveryId,
    );
    assert.equal(repositoryAdded.response.status, 202);
    assert.equal(repositoryAdded.payload.status, "updated");
    assert.deepEqual(repositoryAdded.payload.addedRepositories, [lifecycleRepository]);
    lifecycleEvents += 1;

    const duplicateRepositoryAdded = await sendLifecycle(
      "installation_repositories",
      repositoryAddedPayload,
      repositoryDeliveryId,
    );
    assert.equal(duplicateRepositoryAdded.response.status, 200);
    assert.equal(duplicateRepositoryAdded.payload.status, "duplicate");

    const repositoryRemoved = await sendLifecycle("installation_repositories", {
      ...repositoryAddedPayload,
      action: "removed",
      repositories_added: [],
      repositories_removed: repositoryAddedPayload.repositories_added,
    });
    assert.equal(repositoryRemoved.response.status, 202);
    assert.equal(repositoryRemoved.payload.status, "updated");
    assert.deepEqual(repositoryRemoved.payload.removedRepositories, [lifecycleRepository]);
    lifecycleEvents += 1;

    const finalRepositoryRemoved = await sendLifecycle("installation_repositories", {
      ...repositoryAddedPayload,
      action: "removed",
      repositories_added: [],
      repositories_removed: [{
        ...repositoryAddedPayload.repositories_added[0],
        id: 999_999_999,
        full_name: releaseRepository,
        name: releaseRepository.split("/")[1],
      }],
    });
    assert.equal(finalRepositoryRemoved.response.status, 202);
    assert.deepEqual(finalRepositoryRemoved.payload.removedRepositories, [releaseRepository]);
    lifecycleEvents += 1;
    const repositorylessWorkspace = await jsonRequest(`${baseUrl}/api/v1/control-center`, {
      headers: { cookie },
    });
    const repositorylessGitHub = repositorylessWorkspace.payload.integrations.find(
      (integration) => integration.name === "GitHub",
    );
    assert.equal(repositorylessGitHub.status, "attention");
    assert.match(repositorylessGitHub.mode, /repository access required/i);

    for (const [action, expectedStatus] of [
      ["suspend", "suspended"],
      ["unsuspend", "active"],
      ["deleted", "disconnected"],
    ]) {
      const changed = await sendLifecycle("installation", {
        action,
        installation: {
          ...installation,
          suspended_at: action === "suspend" ? new Date().toISOString() : null,
        },
        sender: { login: "github-installation-owner" },
      });
      assert.equal(changed.response.status, 202);
      assert.equal(changed.payload.status, "updated");
      assert.equal(changed.payload.connectionStatus, expectedStatus);
      lifecycleEvents += 1;
    }

    const lifecycleWorkspace = await jsonRequest(`${baseUrl}/api/v1/control-center`, {
      headers: { cookie },
    });
    const lifecycleGitHub = lifecycleWorkspace.payload.integrations.find(
      (integration) => integration.name === "GitHub",
    );
    assert.equal(lifecycleGitHub.connected, false);
    assert.equal(lifecycleGitHub.status, "attention");
    assert.match(lifecycleGitHub.mode, /installation disconnected/i);
    assert.equal(lifecycleGitHub.githubConnections[0].status, "disconnected");
    assert.equal(
      lifecycleGitHub.githubConnections[0].repositories.every(
        (repository) => repository.enabled === false,
      ),
      true,
    );
    const lifecycleAlertResult = await pool.query(
      `select count(*)::int as count,
              array_agg(payload->>'remediationUrl' order by created_at) as remediation_urls
         from notification_outbox
        where organization_id = $1
          and event_type = 'github.app_lifecycle_alert'`,
      [organizationId],
    );
    assert.equal(lifecycleAlertResult.rows[0].count, 4);
    assert.equal(
      lifecycleAlertResult.rows[0].remediation_urls.every(
        (url) => url.endsWith("/dashboard?view=integrations"),
      ),
      true,
    );
    lifecycleAlerts = lifecycleAlertResult.rows[0].count;
  }

  const integrity = await jsonRequest(`${baseUrl}/api/v1/audit/integrity`, {
    headers: { cookie },
  });
  assert.equal(integrity.response.status, 200);
  assert.equal(integrity.payload.verified, true);
  assert.equal(integrity.payload.organizationsChecked, 1);
  await verifyExpiredAgentCredential(baseUrl);

  return {
    requestId,
    auditEvents: integrity.payload.eventsChecked,
    notificationJobs: queued.rows[0].count,
    failureAlerts,
    governanceId,
    governanceNotifications: governanceNotification.rows[0].count,
    driftIncidents,
    driftNotifications,
    containmentBlocks,
    containmentResolutions,
    lifecycleEvents,
    lifecycleAlerts,
  };
}

async function retryTransientTransaction(operation, attempts = 5) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const retryable = error?.code === "40P01" || error?.code === "40001";
      if (!retryable || attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
    }
  }
}

async function cleanup() {
  if (organizationId) {
    await pool.query(
      "update policies set active_version_id = null where organization_id = $1",
      [organizationId],
    ).catch(() => undefined);
    await retryTransientTransaction(() =>
      pool.query("delete from organizations where id = $1", [organizationId]),
    );
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
  if (result.tenantIsolationVerified) {
    console.log(
      `Remote tenant-isolation journey passed against ${new URL(baseUrl).host}.`,
    );
    console.log(`Request: ${result.requestId}`);
    console.log(`Audit events verified: ${result.auditEvents}`);
    console.log(`Deduplicated notification jobs: ${result.notificationJobs}`);
    console.log("Cross-tenant GitHub App execution: blocked");
  } else if (result.dryRunVerified) {
    console.log(
      `Remote dry-run approval journey passed against ${new URL(baseUrl).host}.`,
    );
    console.log(`Request: ${result.requestId}`);
    console.log(`Audit events verified: ${result.auditEvents}`);
    console.log(`Deduplicated notification jobs: ${result.notificationJobs}`);
  } else {
  console.log(
    remoteBaseUrl
      ? `Remote enterprise approval journey passed against ${new URL(baseUrl).host}.`
      : "Enterprise approval journey passed.",
  );
  console.log(`Request: ${result.requestId}`);
  console.log(`Audit events verified: ${result.auditEvents}`);
  console.log(`Deduplicated notification jobs: ${result.notificationJobs}`);
  console.log(`Durable execution failure alerts: ${result.failureAlerts}`);
  console.log(`Four-eyes release governance: ${result.governanceId}`);
  console.log(`Governance review alerts: ${result.governanceNotifications}`);
  console.log(`GitHub drift incidents reconciled: ${result.driftIncidents}`);
  console.log(`GitHub drift alerts queued: ${result.driftNotifications}`);
  console.log(`Critical containment blocks enforced: ${result.containmentBlocks}`);
  console.log(`Critical containments resolved: ${result.containmentResolutions}`);
  console.log(`GitHub App lifecycle changes enforced: ${result.lifecycleEvents}`);
  console.log(`Durable GitHub App lifecycle alerts: ${result.lifecycleAlerts}`);
  }
} finally {
  await cleanup();
}
