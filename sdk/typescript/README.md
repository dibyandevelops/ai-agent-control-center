# SentinelOps Node.js & TypeScript SDK

[![npm version](https://img.shields.io/badge/npm-v0.2.0-blue.svg)](https://www.npmjs.com/package/@sentinelops/sdk)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-green.svg)](https://opensource.org/licenses/Apache-2.0)
[![Test Suite](https://img.shields.io/badge/tests-passing-emerald.svg)](https://github.com/dibyandevelops/ai-agent-control-center)

Zero-trust policy engine, 4-Eyes dual-authorization gate, and cryptographic audit logging for autonomous AI agents.

Evaluates agent actions in **sub-20ms**, halts risky operations (e.g. database mutations, fund transfers, cloud deployments) for human approval in Slack or the web dashboard, and signs immutable SHA-256 audit records.

---

## What It Means in the Real World

Autonomous AI agents are shifting from read-only chatbots to **consequential actors** that possess API tokens, database credentials, and cloud execution rights. 

Without a zero-trust control plane, an enterprise faces three catastrophic operational risks:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 THE UNGOVERNED AGENT RISK                              │
│                                                                                        │
│   Prompt Injection ──────┐                                                             │
│   Model Hallucination ───┼─► Autonomous Agent ──► Tool Call ──► Production Outage     │
│   Tool Argument Drift ───┘   (Ungoverned)         Direct       (Wire $50k / Drop DB)   │
│                                                                                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                               SENTINELOPS ZERO-TRUST GATEWAY                           │
│                                                                                        │
│   Autonomous Agent ──► Tool Request ──► [SentinelOps Control Plane]                    │
│                                           │  Sub-20ms Policy Eval                      │
│                                           ├── Low Risk: Instant PASS (<20ms) ────────► │
│                                           ├── High Risk: 4-Eyes Slack Approval ──────► │
│                                           └── Forbidden: BLOCKED + SHA-256 Tamper Seal │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Real-World Threat Scenarios Solved

| Real-World Threat | Without SentinelOps | With SentinelOps Governance |
| :--- | :--- | :--- |
| **Financial Fraud / Wire Drift** | An AI customer service agent is tricked via indirect prompt injection into issuing a $25,000 refund or wiring funds to an untrusted account. | Intercepted in <20ms. Financial policy flags amounts >$1,000 as `high risk`, instantly freezing execution and pushing an interactive card to the CFO’s Slack for four-eyes sign-off. |
| **Cloud / Database Destruction** | An autonomous DevOps bot hallucinates `DROP TABLE customers CASCADE` or deletes a production Kubernetes namespace instead of staging. | Hard-blocked by organization-scoped zero-trust policies before the query ever touches the database driver, throwing an `ActionBlockedError`. |
| **Audit & Regulatory Failure** | During SOC 2 Type II or ISO 27001 audit, regulators ask *"Which operator authorized this AI agent to alter customer PII on May 14th?"* Logs are missing or mutable. | Instant export of cryptographically signed SHA-256 hash chains via `/api/v1/compliance/export`, mathematically proving chain of custody and dual approval. |

---

## Installation

```bash
npm install @sentinelops/sdk
# or
pnpm add @sentinelops/sdk
# or
yarn add @sentinelops/sdk
```

---

## Core Quickstart

```typescript
import { SentinelOps } from "@sentinelops/sdk";

const sentinel = new SentinelOps({
  apiKey: process.env.SENTINELOPS_API_KEY, // Defaults to SENTINELOPS_API_KEY env var
  baseUrl: process.env.SENTINELOPS_BASE_URL, // Defaults to https://sentinelops-ai.com
});

// 1. Evaluate policy before executing an action
const decision = await sentinel.evaluate({
  agentId: "db-migration-bot",
  action: "execute_sql_mutation",
  resource: "production-postgresql-cluster",
  riskHint: "high",
  context: { sql: "ALTER TABLE users ADD COLUMN verified boolean;" },
});

if (decision.allowed) {
  // Safe to execute immediately
  await runMigration();
  await sentinel.reportOutcome(decision.requestId, { status: "succeeded" });
} else if (decision.pending) {
  console.log("Action halted: awaiting 4-Eyes approval in Slack / Dashboard...");
  const approved = await sentinel.pollApproval(decision.requestId, { timeoutSeconds: 120 });
  if (approved.allowed) {
    await runMigration();
    await sentinel.reportOutcome(decision.requestId, { status: "succeeded" });
  }
} else {
  console.error(`Blocked by SentinelOps: ${decision.reason}`);
}
```

---

## Vercel AI SDK Integration

Wrap any tool created with the [Vercel AI SDK](https://sdk.vercel.ai/docs) (`ai`) with 1 line of code:

```typescript
import { wrapGovernedTool } from "@sentinelops/sdk/vercel-ai";
import { tool } from "ai";
import { z } from "zod";

const originalTransferTool = tool({
  description: "Wire funds to an external vendor",
  parameters: z.object({
    vendorId: z.string(),
    amount: z.number(),
  }),
  execute: async ({ vendorId, amount }) => {
    return bankingClient.transfer(vendorId, amount);
  },
});

// Wrap tool with SentinelOps zero-trust governance
export const transferTool = wrapGovernedTool(originalTransferTool, {
  client: sentinel,
  agentId: "finance-agent",
  action: "wire_transfer",
  resourceExtractor: (args) => `vendor://${args.vendorId}`,
});
```

---

## LangChain.js Integration

Protect LangChain agents automatically across all tool calls:

```typescript
import { SentinelOpsCallbackHandler } from "@sentinelops/sdk/langchain";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

const handler = new SentinelOpsCallbackHandler({
  client: sentinel,
  agentId: "customer-support-agent",
  waitForApproval: true, // Automatically halts execution if 4-Eyes review is required
});

const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "zero-shot-react-description",
  callbacks: [handler],
});
```

---

## How Can You Test Them?

We provide four distinct testing strategies for development, CI/CD, and production readiness:

### 1. Run the 60-Second End-to-End Live Demo

We provide a complete runnable demo script in `examples/demo-governed-agent.ts` that exercises all three governance paths:
1. Low-risk query -> Evaluated & allowed in <20ms.
2. High-risk wire transfer -> Halts in `pending` awaiting 4-Eyes review.
3. Destructive query -> Blocked with `ActionBlockedError`.

```bash
# Set your API key
export SENTINELOPS_API_KEY="sop_live_your_key_here"

# Optional: test against local dev instance
export SENTINELOPS_BASE_URL="http://localhost:3000"

# Run with tsx
npx tsx examples/demo-governed-agent.ts
```

### 2. Unit Testing Your Agent Tools (Vitest / Jest)

When testing your agents in CI/CD without calling the live network, mock `SentinelOps` to verify how your application handles different policy decisions:

```typescript
import { describe, expect, it, vi } from "vitest";
import { ActionBlockedError, SentinelOps } from "@sentinelops/sdk";

describe("Agent Tool Governance Test", () => {
  it("executes tool when policy allows it", async () => {
    const sentinel = new SentinelOps({ apiKey: "sop_test_key" });
    
    // Mock evaluate to return 'allowed'
    vi.spyOn(sentinel, "evaluate").mockResolvedValue({
      requestId: "mock-req-01",
      status: "allowed",
      risk: "low",
      reason: "Safe read policy",
      evaluatedAt: new Date().toISOString(),
      allowed: true,
      pending: false,
      blocked: false,
    });
    vi.spyOn(sentinel, "reportOutcome").mockResolvedValue();

    const result = await sentinel.executeWithGovernance(
      { agentId: "test-bot", action: "read_stats", resource: "stats" },
      async () => ({ users: 100 })
    );

    expect(result).toEqual({ users: 100 });
  });

  it("throws ActionBlockedError when policy denies execution", async () => {
    const sentinel = new SentinelOps({ apiKey: "sop_test_key" });
    
    // Mock evaluate to return 'blocked'
    vi.spyOn(sentinel, "evaluate").mockResolvedValue({
      requestId: "mock-req-02",
      status: "blocked",
      risk: "high",
      reason: "Unauthorized table drop",
      evaluatedAt: new Date().toISOString(),
      allowed: false,
      pending: false,
      blocked: true,
    });

    await expect(
      sentinel.executeWithGovernance(
        { agentId: "test-bot", action: "drop_table", resource: "prod_db" },
        async () => { throw new Error("Should not execute!"); }
      )
    ).rejects.toThrow(ActionBlockedError);
  });
});
```

### 3. Integration Testing Vercel AI SDK Tools

Verify that `wrapGovernedTool` properly blocks tool execution:

```typescript
import { describe, expect, it, vi } from "vitest";
import { wrapGovernedTool } from "@sentinelops/sdk/vercel-ai";
import { ActionBlockedError, SentinelOps } from "@sentinelops/sdk";

it("governed tool prevents execute when blocked", async () => {
  const sentinel = new SentinelOps({ apiKey: "sop_test_key" });
  vi.spyOn(sentinel, "evaluate").mockResolvedValue({
    requestId: "req-blocked",
    status: "blocked",
    risk: "high",
    reason: "Blocked by security rule",
    evaluatedAt: new Date().toISOString(),
    allowed: false,
    pending: false,
    blocked: true,
  });

  const underlyingApi = vi.fn();
  const rawTool = {
    description: "Mutate database",
    execute: underlyingApi,
  };

  const governed = wrapGovernedTool(rawTool, {
    client: sentinel,
    agentId: "sql-agent",
    action: "mutate_db",
  });

  await expect(governed.execute?.({ query: "DELETE FROM users" })).rejects.toThrow(ActionBlockedError);
  expect(underlyingApi).not.toHaveBeenCalled();
});
```

### 4. Verifying Cryptographic Tamper-Evidence

After running agent actions, verify that your actions were cryptographically sealed into the SHA-256 hash chain:

```bash
# Query the live audit integrity endpoint
curl -s -H "Authorization: Bearer sop_live_your_key" \
  https://sentinelops-ai.com/api/v1/audit/integrity | jq .

# Response:
# {
#   "verified": true,
#   "eventsChecked": 428,
#   "firstInvalidEventId": null,
#   "checkedAt": "2026-09-07T11:50:00.000Z"
# }
```

---

## Security & Compliance Standard

- **Sub-20ms Evaluation SLA**: Distributed in-memory policy lookup engine designed for production request pipelines without introducing user-visible latency.
- **Interactive 5-Second Undo Grace Period**: Human approvals/rejections in Slack and the web console include an optimistic 5s reversible grace window to prevent accidental tool execution.
- **Emergency Quarantine Kill-Switch**: Strip permissions from rogue or compromised agents across the fleet in <4ms without redeploying code.
- **Four-Eyes Dual Control (HITL)**: Enforces dual-authorization where dangerous agent actions halt until a distinct human reviewer approves.
- **SOC 2 Type II & ISO 27001 Annex A.12**: Complete cryptographic verification certificate available via `/api/v1/compliance/export`.

---

## License

Apache 2.0. Maintained by the SentinelOps Security Architecture Team `<iruka@sentinelops-ai.com>`.
