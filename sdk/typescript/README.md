# SentinelOps Node.js & TypeScript SDK

[![npm version](https://img.shields.io/badge/npm-v0.2.0-blue.svg)](https://www.npmjs.com/package/@sentinelops/sdk)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-green.svg)](https://opensource.org/licenses/Apache-2.0)

Zero-trust policy engine, 4-Eyes dual-authorization gate, and cryptographic audit logging for autonomous AI agents.

Evaluates agent actions in **sub-20ms**, halts risky operations (e.g. database mutations, fund transfers, cloud deployments) for human approval in Slack or the web dashboard, and signs immutable SHA-256 audit records.

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

## Quickstart

```typescript
import { SentinelOps } from "@sentinelops/sdk";

const sentinel = new SentinelOps({
  apiKey: process.env.SENTINELOPS_API_KEY, // Or defaults to SENTINELOPS_API_KEY env var
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
  // Safe to execute
  await runMigration();
  await sentinel.reportOutcome(decision.requestId, { status: "succeeded" });
} else if (decision.pending) {
  console.log("Action halted for 4-Eyes human approval in Slack/Dashboard...");
  const approved = await sentinel.pollApproval(decision.requestId);
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

Protect tools created with the [Vercel AI SDK](https://sdk.vercel.ai/docs) with zero boilerplate:

```typescript
import { wrapGovernedTool } from "@sentinelops/sdk/vercel-ai";
import { tool } from "ai";
import { z } from "zod";

const originalTransferTool = tool({
  description: "Wire funds to an external IBAN",
  parameters: z.object({
    iban: z.string(),
    amount: z.number(),
  }),
  execute: async ({ iban, amount }) => {
    return bankingClient.transfer(iban, amount);
  },
});

// Wrap tool with SentinelOps governance
export const transferTool = wrapGovernedTool(originalTransferTool, {
  client: sentinel,
  agentId: "finance-agent",
  action: "wire_transfer",
  resourceExtractor: (args) => `iban://${args.iban}`,
});
```

---

## LangChain.js Integration

Drop into any LangChain agent with the official callback handler:

```typescript
import { SentinelOpsCallbackHandler } from "@sentinelops/sdk/langchain";
import { initializeAgentExecutorWithOptions } from "langchain/agents";

const handler = new SentinelOpsCallbackHandler({
  client: sentinel,
  agentId: "langchain-customer-agent",
});

const executor = await initializeAgentExecutorWithOptions(tools, model, {
  agentType: "zero-shot-react-description",
  callbacks: [handler],
});
```

---

## Security & Compliance

- **Cryptographic Audit Trails**: Every decision and tool output is sealed in a SHA-256 hash chain verifiable via `/api/v1/compliance/export`.
- **Four-Eyes Dual Control**: Critical operations require independent administrator sign-off preventing rogue agent mutations.
- **Sub-20ms SLA**: Low-latency synchronous evaluation designed for production runtime environments.

## License

Apache 2.0. Built by the SentinelOps Security Team `<iruka@sentinelops-ai.com>`.
