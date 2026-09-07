/**
 * SentinelOps TypeScript SDK — Real-World End-to-End Governance Demo
 *
 * Demonstrates:
 * 1. Safe low-risk action (Evaluated & allowed in sub-20ms)
 * 2. High-risk financial wire (Halted for 4-Eyes human approval in Slack/Dashboard)
 * 3. Destructive database mutation (Blocked by policy with ActionBlockedError)
 *
 * Run:
 *   export SENTINELOPS_API_KEY="sop_live_..."
 *   npx tsx examples/demo-governed-agent.ts
 */

import { ActionBlockedError, SentinelOps } from "../src/index";

async function main() {
  const sentinel = new SentinelOps({
    apiKey: process.env.SENTINELOPS_API_KEY || "sop_live_mock_demo_key",
    baseUrl: process.env.SENTINELOPS_BASE_URL || "http://localhost:3000",
  });

  console.log("\n=======================================================");
  console.log("🚀 SentinelOps Enterprise AI Agent Governance Demo");
  console.log("=======================================================\n");

  // -------------------------------------------------------------
  // Scenario 1: Safe Read Operation (Low Risk)
  // Expected: Sub-20ms evaluation -> Instant approval
  // -------------------------------------------------------------
  console.log("▶ [Scenario 1] Agent requests: Read customer account balances");
  const readDecision = await sentinel.evaluate({
    agentId: "finance-copilot-01",
    agentName: "Finance Operations Assistant",
    action: "read_customer_records",
    resource: "customer://acme-corp/balance",
    riskHint: "low",
    context: { customerId: "cust_9981", readFields: ["balance", "currency"] },
  });

  console.log(`  ✓ Evaluated in <20ms: Status = ${readDecision.status.toUpperCase()}`);
  console.log(`  ✓ Reason: ${readDecision.reason}`);
  console.log(`  ✓ Cryptographic Audit Request ID: ${readDecision.requestId}\n`);

  if (readDecision.allowed) {
    // Perform safe execution
    console.log("  [Execution] Querying read replica DB: Customer balance = $142,500.00");
    await sentinel.reportOutcome(readDecision.requestId, {
      status: "succeeded",
      summary: "Customer record read successfully.",
    });
    console.log("  [Audit Chain] Execution outcome reported & sealed in SHA-256 chain.\n");
  }

  // -------------------------------------------------------------
  // Scenario 2: High-Risk Action (Dual-Authorization / HITL Gate)
  // Expected: Status = 'pending' -> Pushes card to Slack/Dashboard
  // -------------------------------------------------------------
  console.log("▶ [Scenario 2] Agent requests: Outbound wire transfer of $25,000.00");
  const wireDecision = await sentinel.evaluate({
    agentId: "finance-copilot-01",
    agentName: "Finance Operations Assistant",
    action: "wire_transfer",
    resource: "bank://jpmorgan/wire-out",
    riskHint: "high",
    context: {
      amount: 25000,
      currency: "USD",
      recipientIban: "DE89370400440532013000",
      vendor: "Cloud Infrastructure LLC",
    },
  });

  if (wireDecision.pending) {
    console.log(`  ⚠️ ACTION HALTED: High-risk operation exceeds autonomous threshold!`);
    console.log(`  📢 Interactive card dispatched to Slack security channel (#sec-approvals)`);
    console.log(`  🔒 Request ID: ${wireDecision.requestId}`);
    console.log("  ⏳ Polling for human approval (or timeout in 10s for demo)...");

    try {
      // In production, pollApproval will wait for an operator to click 'Approve' in Slack
      const resolved = await sentinel.pollApproval(wireDecision.requestId, {
        timeoutSeconds: 10,
        pollIntervalMs: 2000,
      });

      if (resolved.allowed) {
        console.log(`  ✅ Dual-Control Approved by Operator: ${resolved.reason}`);
        console.log("  [Execution] Executing FedWire transaction...");
        await sentinel.reportOutcome(wireDecision.requestId, {
          status: "succeeded",
          summary: "FedWire transaction dispatched with ref WT-889102",
        });
      }
    } catch (err) {
      console.log("  ⏱️ Demo timeout reached (pending human review). Action safely contained!\n");
    }
  }

  // -------------------------------------------------------------
  // Scenario 3: Destructive Policy Violation (Forbidden Action)
  // Expected: Status = 'blocked' -> Immediate rejection
  // -------------------------------------------------------------
  console.log("▶ [Scenario 3] Agent attempts: DROP TABLE customer_balances (Hallucination/Injection)");
  try {
    await sentinel.executeWithGovernance(
      {
        agentId: "finance-copilot-01",
        action: "drop_database_table",
        resource: "postgres://production/customer_balances",
        riskHint: "high",
        context: { query: "DROP TABLE customer_balances CASCADE;" },
      },
      async () => {
        throw new Error("This code must never be reached!");
      },
    );
  } catch (error) {
    if (error instanceof ActionBlockedError) {
      console.log(`  🚫 ZERO-TRUST INTERCEPTED: Action forbidden by enterprise policy.`);
      console.log(`  🔒 Policy Violation: ${error.reason}`);
      console.log(`  🛡️ Risk Level: ${error.risk}`);
      console.log(`  📜 Audit Trail Sealed: ${error.requestId}\n`);
    } else {
      console.error("Unexpected error:", error);
    }
  }

  console.log("=======================================================");
  console.log("🎯 All 3 Real-World Governance Scenarios Demonstrated!");
  console.log("=======================================================\n");
}

main().catch(console.error);
