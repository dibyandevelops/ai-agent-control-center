#!/usr/bin/env node

/**
 * Real-World Scenario: Autonomous Database & SQL Migration Agent ("DBA-Bot")
 * 
 * In production engineering, letting an AI Agent run SQL directly against databases
 * is terrifying without guardrails. 
 * 
 * SentinelOps provides zero-trust governance:
 * 1. Safe, read-only SELECT queries are auto-approved in < 20ms.
 * 2. High-risk mutations (ALTER TABLE, UPDATE without WHERE, DROP, production migrations)
 *    are intercepted and routed for human approval before execution.
 */

import process from "node:process";

const apiKey = process.env.SENTINELOPS_AGENT_API_KEY || "sop_live_uBWumvwD2yrQRT4yGwTmwQY-faxFho8Y";
const baseUrl = process.env.SENTINELOPS_URL || "http://localhost:3000";

const headers = {
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
};

// Simulated Database Runner
class DatabaseClient {
  async executeQuery(sql, env) {
    console.log(`\n  💾 [DB:${env.toUpperCase()}] Executing: "${sql}"`);
    // Simulated query latency
    await new Promise((r) => setTimeout(r, 400));
    return { status: "success", rowsAffected: 1, durationMs: 42 };
  }
}

const db = new DatabaseClient();

async function evaluateWithSentinelOps(actionPayload) {
  const res = await fetch(`${baseUrl}/api/v1/actions/evaluate`, {
    method: "POST",
    headers,
    body: JSON.stringify(actionPayload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`SentinelOps evaluation failed (${res.status}): ${errorBody}`);
  }

  return await res.json();
}

async function pollForHumanApproval(requestId, maxSeconds = 120) {
  console.log(`\n  ⏸️  [SentinelOps] Consequential action intercepted! Awaiting human sign-off.`);
  console.log(`  👉 Open your dashboard: ${baseUrl}/dashboard to review and approve.`);
  console.log(`  ⏳ Polling approval status for Request ID: ${requestId}...`);

  const startTime = Date.now();
  while (Date.now() - startTime < maxSeconds * 1000) {
    await new Promise((r) => setTimeout(r, 3000));
    
    const res = await fetch(`${baseUrl}/api/v1/actions/${requestId}`, { headers });
    if (!res.ok) continue;

    const data = await res.json();
    const status = data.actionRequest?.status || data.status;

    if (status === "approved") {
      console.log(`  🎉 [SentinelOps] OPERATOR APPROVED THE REQUEST! Continuing execution...`);
      return { approved: true, operator: data.decisionByEmail || "admin" };
    }

    if (status === "denied") {
      console.log(`  ❌ [SentinelOps] OPERATOR REJECTED THE REQUEST: ${data.decisionReason || "Denied by operator"}`);
      return { approved: false, reason: data.decisionReason };
    }

    process.stdout.write(".");
  }

  throw new Error("Timed out waiting for human operator approval.");
}

async function reportOutcome(requestId, outcome) {
  await fetch(`${baseUrl}/api/v1/actions/${requestId}/outcome`, {
    method: "POST",
    headers,
    body: JSON.stringify(outcome),
  });
  console.log(`  🔒 [SentinelOps] Outcome recorded into cryptographic SHA-256 Merkle audit trail.\n`);
}

async function runAutonomousDBAgent() {
  console.log("================================================================================");
  console.log("🤖 Autonomous Database Agent (\"DBA-Bot v2\") Online");
  console.log("Target Database: PostgreSQL Cluster (us-east-1)");
  console.log("================================================================================\n");

  // -------------------------------------------------------------------------
  // STEP 1: Safe Read-Only Query (Auto-Approved)
  // -------------------------------------------------------------------------
  console.log("▶ [Task 1/2] Agent analyzing slow queries and indexing requirements...");
  const readQuery = "SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE n_dead_tup > 5000;";
  
  const readEvaluation = await evaluateWithSentinelOps({
    idempotencyKey: `dba-read-${Date.now()}`,
    agent: {
      externalId: "dba-agent-01",
      name: "Autonomous DBA Agent",
      ownerEmail: "data-eng@sentinelops-ai.com",
      team: "Data Infrastructure",
      provider: "Anthropic Claude 3.5 Sonnet",
    },
    action: "db.query.select",
    resource: "postgres://production-cluster/analytics",
    environment: "development",
    context: {
      query: readQuery,
      isReadOnly: true,
      estimatedCost: 1.2,
    },
  });

  console.log(`  🛡️  Policy Engine Decision: ${readEvaluation.status.toUpperCase()} (Auto-Approved in <20ms)`);
  console.log(`  ⚡ Rule Matched: "${readEvaluation.reason || "Safe Read Default"}"`);

  // Execute safe query immediately
  await db.executeQuery(readQuery, "development");
  console.log("  ✅ Read query executed cleanly.");

  // -------------------------------------------------------------------------
  // STEP 2: Consequential Production Schema Migration (Intercepted!)
  // -------------------------------------------------------------------------
  console.log("\n--------------------------------------------------------------------------------");
  console.log("▶ [Task 2/2] Agent detected needed schema index on high-traffic production table:");
  const migrationSQL = "ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(64) NOT NULL UNIQUE;";
  console.log(`  Proposed SQL: "${migrationSQL}"`);

  console.log("  Evaluating consequential action with SentinelOps...");
  const migrationEvaluation = await evaluateWithSentinelOps({
    idempotencyKey: `dba-migration-${Date.now()}`,
    agent: {
      externalId: "dba-agent-01",
      name: "Autonomous DBA Agent",
      ownerEmail: "data-eng@sentinelops-ai.com",
      team: "Data Infrastructure",
      provider: "Anthropic Claude 3.5 Sonnet",
    },
    action: "db.schema.migration",
    resource: "postgres://production-cluster/orders",
    environment: "production", // Production environment triggers safety guardrail
    context: {
      sql: migrationSQL,
      table: "orders",
      affectedRowCount: 2500000,
      migrationLockTimeoutMs: 5000,
      changeTicket: "CHG-DB-8891",
      rollbackPlan: "ALTER TABLE orders DROP COLUMN idempotency_key;",
    },
  });

  const status = migrationEvaluation.status;
  const requestId = migrationEvaluation.requestId;

  if (status === "pending") {
    // Intercepted! Wait for human sign-off on the dashboard
    const approvalResult = await pollForHumanApproval(requestId);

    if (approvalResult.approved) {
      // Human approved -> Proceed with mutation
      const executionResult = await db.executeQuery(migrationSQL, "production");
      
      // Report success back to SentinelOps
      await reportOutcome(requestId, {
        status: "succeeded",
        summary: `Migration executed in ${executionResult.durationMs}ms with human sign-off from ${approvalResult.operator}.`,
      });
      console.log("🏁 Autonomous Database Agent successfully completed all tasks!");
    } else {
      console.log("🛑 Migration aborted per operator denial.");
      await reportOutcome(requestId, {
        status: "cancelled",
        summary: `Execution aborted: ${approvalResult.reason}`,
      });
    }
  } else if (status === "allowed" || status === "approved") {
    console.log("  ✅ Action auto-approved by policy.");
    await db.executeQuery(migrationSQL, "production");
  } else {
    console.log(`  🚫 Action BLOCKED by policy: ${migrationEvaluation.reason}`);
  }
}

runAutonomousDBAgent().catch((err) => {
  console.error("\n❌ Agent run failed:", err.message);
  process.exit(1);
});
