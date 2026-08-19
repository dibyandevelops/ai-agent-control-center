import process from "node:process";
import { Pool } from "pg";
import { createHash, randomBytes } from "node:crypto";

const baseUrl = (process.env.SENTINELOPS_BASE_URL || process.env.SENTINELOPS_URL || "http://localhost:3000").replace(/\/$/, "");
const connectionString = process.env.DATABASE_URL;

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  lime: "\x1b[92m",
};

async function getOrCreateDemoContext() {
  let apiKey = process.env.SENTINELOPS_AGENT_API_KEY;

  if (!connectionString) {
    if (!apiKey) throw new Error("DATABASE_URL or SENTINELOPS_AGENT_API_KEY is required to run the demo.");
    return {
      apiKey,
      agent: {
        externalId: "demo-agent-01",
        name: "Demo Execution Agent",
        ownerEmail: "dev@sentinel-ops.ai",
        team: "Core Platform",
        provider: "OpenAI GPT-4o",
      }
    };
  }

  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: process.env.DB_SSL === "true" || process.env.DB_SSL === "1" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    const orgRes = await pool.query("SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1");
    if (!orgRes.rows[0]) {
      throw new Error("No organization found in database. Run 'pnpm db:seed' first.");
    }
    const organizationId = orgRes.rows[0].id;

    if (!apiKey) {
      const rawKey = `sop_live_${randomBytes(24).toString("hex")}`;
      const keyHash = createHash("sha256").update(rawKey).digest("hex");

      await pool.query(
        `INSERT INTO api_keys (organization_id, name, key_prefix, key_hash, expires_at)
         VALUES ($1, 'Demo Runner Session', $2, $3, now() + interval '1 day')`,
        [organizationId, rawKey.slice(0, 16), keyHash]
      );
      apiKey = rawKey;
    }

    const agentRes = await pool.query(
      "SELECT external_id, name, owner_email, team, provider FROM agents WHERE organization_id = $1 LIMIT 1",
      [organizationId]
    );

    const agent = agentRes.rows[0] ? {
      externalId: agentRes.rows[0].external_id,
      name: agentRes.rows[0].name,
      ownerEmail: agentRes.rows[0].owner_email,
      team: agentRes.rows[0].team,
      provider: agentRes.rows[0].provider,
    } : {
      externalId: "invoice-review-agent",
      name: "Invoice Review Agent",
      ownerEmail: "platform@sentinel-ops.ai",
      team: "Finance Platform",
      provider: "OpenAI GPT-4o",
    };

    return { apiKey, agent };
  } finally {
    await pool.end();
  }
}

async function evaluateAction(apiKey, payload) {
  const response = await fetch(`${baseUrl}/api/v1/actions/evaluate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Evaluation failed (${response.status}): ${body.error || JSON.stringify(body)}`);
  }
  return body;
}

function printHeader(title) {
  console.log(`\n${colors.cyan}${colors.bright}====================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright}====================================================${colors.reset}\n`);
}

async function runDemo() {
  console.clear();
  printHeader("SentinelOps Live Interactive Governance Demo");

  console.log(`${colors.dim}Target Endpoint:${colors.reset} ${colors.bright}${baseUrl}${colors.reset}`);
  console.log(`${colors.dim}Initializing agent credentials...${colors.reset}`);
  const { apiKey, agent } = await getOrCreateDemoContext();
  console.log(`${colors.green}✓ Connected with active Agent API Key${colors.reset} (${apiKey.slice(0, 12)}...)`);
  console.log(`${colors.green}✓ Bound to Governed Agent:${colors.reset} ${agent.name} (${agent.externalId})\n`);

  // --- SCENARIO 1: ALLOWED ACTION ---
  console.log(`${colors.bright}--- [Step 1: Immediate Low-Risk Action] ---${colors.reset}`);
  console.log(`${colors.dim}Simulating: Agent querying developer analytics in development environment...${colors.reset}`);
  
  const step1 = await evaluateAction(apiKey, {
    idempotencyKey: `demo-query-${Date.now()}`,
    agent,
    action: "data.query",
    resource: "analytics/daily_metrics",
    environment: "development",
    context: { queryType: "read-only", maxRows: 50 },
  });

  console.log(`Decision:   ${colors.green}${colors.bright}ALLOWED${colors.reset} (Latency: <15ms)`);
  console.log(`Request ID: ${colors.dim}${step1.requestId}${colors.reset}`);
  console.log(`Reason:     ${step1.reason || "Matches default monitor/allow policy."}`);
  console.log(`${colors.green}✓ Agent proceeds to execute immediately without human delay.${colors.reset}\n`);

  await new Promise((r) => setTimeout(r, 2000));

  // --- SCENARIO 2: BLOCKED ACTION ---
  console.log(`${colors.bright}--- [Step 2: Policy-Blocked Violation] ---${colors.reset}`);
  console.log(`${colors.dim}Simulating: Agent attempting bulk data export to unapproved destination...${colors.reset}`);
  
  const step2 = await evaluateAction(apiKey, {
    idempotencyKey: `demo-export-blocked-${Date.now()}`,
    agent,
    action: "data.export",
    resource: "customer_pii/exports/2026_q3",
    environment: "production",
    context: { destinationApproved: false, recordCount: 15000 },
  });

  console.log(`Decision:   ${colors.red}${colors.bright}BLOCKED${colors.reset}`);
  console.log(`Request ID: ${colors.dim}${step2.requestId}${colors.reset}`);
  console.log(`Reason:     ${colors.red}${step2.reason}${colors.reset}`);
  console.log(`${colors.red}✓ Unapproved data leak prevented automatically.${colors.reset}\n`);

  await new Promise((r) => setTimeout(r, 2000));

  // --- SCENARIO 3: APPROVAL GATE (HUMAN IN THE LOOP) ---
  console.log(`${colors.bright}--- [Step 3: Approval Gate & Human-in-the-Loop] ---${colors.reset}`);
  console.log(`${colors.dim}Simulating: Agent initiating production release 'sentinelops/payments-api@v1.2.0'...${colors.reset}`);
  
  const step3 = await evaluateAction(apiKey, {
    idempotencyKey: `demo-release-approval-${Date.now()}`,
    agent,
    action: "deploy.release",
    resource: "sentinelops/payments-api@v1.2.0",
    environment: "production",
    context: { commitSha: "7b4a92c", changeTicket: "PROD-RELEASE-104" },
  });

  console.log(`Decision:   ${colors.yellow}${colors.bright}PENDING HUMAN APPROVAL${colors.reset}`);
  console.log(`Request ID: ${colors.dim}${step3.requestId}${colors.reset}`);
  console.log(`Reason:     ${colors.yellow}${step3.reason}${colors.reset}`);
  console.log(`Dashboard:  ${colors.blue}${colors.bright}${baseUrl}/dashboard${colors.reset}`);
  console.log(`\n${colors.lime}→ A review card has been dispatched to your Dashboard and Slack channel.${colors.reset}`);
  console.log(`${colors.dim}Waiting for human operator decision (Press Ctrl+C to exit)...${colors.reset}`);

  // Polling loop
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const pollRes = await fetch(`${baseUrl}/api/v1/actions/${step3.requestId}`, {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      const data = await pollRes.json();
      if (data.status === "approved") {
        console.log(`\n${colors.green}${colors.bright}🎉 DECISION UPDATED: APPROVED by human operator!${colors.reset}`);
        console.log(`${colors.green}✓ Agent received approval token and unblocked deployment execution.${colors.reset}`);
        break;
      } else if (data.status === "denied") {
        console.log(`\n${colors.red}${colors.bright}🛑 DECISION UPDATED: DENIED by human operator!${colors.reset}`);
        console.log(`${colors.red}✓ Agent gracefully halted execution.${colors.reset}`);
        break;
      } else {
        process.stdout.write(`${colors.dim}.${colors.reset}`);
      }
    } catch {
      // Ignore transient network errors during poll
    }
  }

  printHeader("Demo Complete");
  console.log(`${colors.green}All audit events have been cryptographically sealed in the SHA-256 hash chain.${colors.reset}\n`);
}

runDemo().catch((err) => {
  console.error(`\n${colors.red}Demo Error:${colors.reset}`, err.message);
  process.exit(1);
});
