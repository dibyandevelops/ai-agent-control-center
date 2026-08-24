import assert from "node:assert/strict";

const baseUrl = process.env.BASE_URL || "http://localhost:3000";

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { response, payload };
}

async function run() {
  console.log(`\n🔍 Verifying all UI CTAs & Actions against ${baseUrl}...`);

  // 1. Health check
  const health = await jsonRequest(`${baseUrl}/api/health`);
  assert.equal(health.response.status, 200, "Health check failed");
  console.log("  ✓ Health Check: 200 OK");

  // 2. Operator login
  const loginRes = await jsonRequest(`${baseUrl}/api/v1/session`, {
    method: "POST",
    body: JSON.stringify({
      email: "admin@sentinelops.local",
      password: "Stg-L3SWrdHfLtfLD6MsYewq6h6KJGAXmIld!",
    }),
  });
  assert.equal(loginRes.response.status, 200, "Operator login failed");
  const cookie = loginRes.response.headers.get("set-cookie");
  assert.ok(cookie, "Session cookie missing");
  console.log("  ✓ Operator Login & Session Cookie: 200 OK");

  // 3. Control Center Dashboard Data (Overview, Metrics, Integrations, Policies, Agents)
  const ccRes = await jsonRequest(`${baseUrl}/api/v1/control-center`, {
    headers: { cookie },
  });
  assert.equal(ccRes.response.status, 200, "Control Center data load failed");
  const data = ccRes.payload;
  assert.ok(data.integrations, "Integrations payload missing");
  assert.ok(data.policies, "Policies payload missing");
  assert.ok(data.agents, "Agents payload missing");
  assert.ok(data.audit, "Audit payload missing");
  console.log(`  ✓ Control Center Overview: 200 OK (${data.policies.length} policies, ${data.agents.length} agents, ${data.integrations.length} integrations, ${data.audit.length} audit records)`);

  // 4. Policy Simulation & Sandbox CTA (Environment Filter & Replay Sample Limit)
  const simRes = await jsonRequest(`${baseUrl}/api/v1/policies/simulate`, {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({
      name: "Production release enforcement",
      priority: 10,
      effect: "approval",
      conditions: {
        all: [{ field: "environment", operator: "eq", value: "production" }],
      },
      limit: 50,
      environment: "production",
    }),
  });
  assert.equal(simRes.response.status, 200, `Policy simulation failed: ${JSON.stringify(simRes.payload)}`);
  assert.ok(simRes.payload.rows, "Simulation rows missing");
  console.log(`  ✓ Policy Trace Sandbox Simulation (50 traces, production filter): 200 OK (${simRes.payload.rows.length} traces replayed, ${simRes.payload.changedDecisionCount} decision changes)`);

  // 5. Ad-Hoc Synthetic Action Dry-Run CTA
  const synthRes = await jsonRequest(`${baseUrl}/api/v1/policies/simulate`, {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({
      name: "Synthetic tester policy",
      priority: 10,
      effect: "block",
      conditions: {
        all: [{ field: "action", operator: "eq", value: "deploy.release" }],
      },
      syntheticAction: {
        action: "deploy.release",
        resource: "production-us-east",
        environment: "production",
        context: { isProduction: true },
      },
    }),
  });
  assert.equal(synthRes.response.status, 200, `Synthetic dry-run failed: ${JSON.stringify(synthRes.payload)}`);
  assert.ok(synthRes.payload.syntheticResult, "Synthetic simulation result missing");
  console.log(`  ✓ Ad-Hoc Synthetic Action Dry-Run ('deploy.release'): 200 OK (Simulated Effect: ${synthRes.payload.syntheticResult.simulatedEffect.toUpperCase()})`);

  // 6. Agent Quarantine Killswitch & Unquarantine CTA
  if (data.agents.length > 0) {
    const targetAgent = data.agents[0];
    const quarRes = await jsonRequest(`${baseUrl}/api/v1/agents/${targetAgent.id}/quarantine`, {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ reason: "Automated CTA UI validation drill" }),
    });
    assert.equal(quarRes.response.status, 200, "Quarantine action failed");
    console.log(`  ✓ Emergency Agent Quarantine Killswitch CTA: 200 OK (Agent: ${targetAgent.name})`);

    const unquarRes = await jsonRequest(`${baseUrl}/api/v1/agents/${targetAgent.id}/unquarantine`, {
      method: "POST",
      headers: { cookie },
      body: JSON.stringify({ reason: "Completed automated CTA drill" }),
    });
    assert.equal(unquarRes.response.status, 200, "Unquarantine action failed");
    console.log(`  ✓ Agent Restore / Unquarantine CTA: 200 OK (Agent: ${targetAgent.name})`);
  }

  // 7. Identity & SCIM 2.0 Token Rotation CTA
  const scimRes = await jsonRequest(`${baseUrl}/api/v1/identity/scim-token`, {
    method: "POST",
    headers: { cookie },
  });
  assert.ok(scimRes.response.status === 200 || scimRes.response.status === 201, `SCIM token rotation failed: ${scimRes.response.status}`);
  assert.ok(scimRes.payload.token, "SCIM token missing");
  console.log("  ✓ SCIM 2.0 Token Rotation & Generation CTA: 201 OK");

  // 8. Agent API Key Creation & Rotation CTA
  const apiKeyRes = await jsonRequest(`${baseUrl}/api/v1/api-keys`, {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({
      name: "Autonomous Release Bot Key",
      environment: "staging",
    }),
  });
  assert.equal(apiKeyRes.response.status, 201, "API Key creation failed");
  assert.ok(apiKeyRes.payload.secret, "Raw API key secret missing in creation payload");
  console.log(`  ✓ Agent API Key Generation CTA: 201 Created (Key ID: ${apiKeyRes.payload.apiKey.id})`);

  const rotateKeyRes = await jsonRequest(`${baseUrl}/api/v1/api-keys/${apiKeyRes.payload.apiKey.id}/rotate`, {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(rotateKeyRes.response.status, 200, "API Key rotation failed");
  assert.ok(rotateKeyRes.payload.secret, "Rotated secret key missing");
  console.log(`  ✓ Agent API Key Rotation CTA: 200 OK`);

  // 9. Operator Invitation & Revocation CTA
  const inviteRes = await jsonRequest(`${baseUrl}/api/v1/invitations`, {
    method: "POST",
    headers: { cookie },
    body: JSON.stringify({
      email: `pilot-test-${Date.now()}@sentinelops.local`,
      role: "approver",
    }),
  });
  assert.equal(inviteRes.response.status, 201, "Operator invitation failed");
  const invitationId = inviteRes.payload.invitation.id;
  console.log(`  ✓ Operator Invitation Dispatch CTA: 201 Created (ID: ${invitationId})`);

  const revokeInviteRes = await jsonRequest(`${baseUrl}/api/v1/invitations/${invitationId}/revoke`, {
    method: "POST",
    headers: { cookie },
  });
  assert.equal(revokeInviteRes.response.status, 200, "Invitation revocation failed");
  console.log(`  ✓ Operator Invitation Revoke CTA: 200 OK`);

  // 10. Audit Integrity Verification CTA
  const integrityRes = await jsonRequest(`${baseUrl}/api/v1/audit/integrity`, {
    headers: { cookie },
  });
  assert.equal(integrityRes.response.status, 200, "Audit integrity check failed");
  assert.equal(integrityRes.payload.verified, true, "Audit chain integrity verification failed");
  console.log(`  ✓ Tamper-Evident Audit Hash Chain Integrity CTA: 200 OK (${integrityRes.payload.eventsChecked} events verified)`);

  // 11. Audit Log CSV/JSON Export CTA
  const exportRes = await jsonRequest(`${baseUrl}/api/v1/audit/export?format=json`, {
    headers: { cookie },
  });
  assert.equal(exportRes.response.status, 200, "Audit export failed");
  console.log("  ✓ Audit Log Export CTA: 200 OK");

  console.log("\n🎉 ALL UI CTAs, ACTIONS, & WORKFLOWS VALIDATED SUCCESSFULLY!\n");
}

run().catch((err) => {
  console.error("❌ CTA Validation Error:", err);
  process.exit(1);
});
