"use client";

import {
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  Code2,
  Copy,
  ExternalLink,
  FileCode,
  KeyRound,
  Layers,
  Lock,
  Play,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { BrandMark } from "@/components/dashboard/navigation/sidebar";
import { InteractivePolicySandbox } from "@/components/landing/interactive-policy-sandbox";

export default function ConnectingAgentsDocPage() {
  const [selectedLang, setSelectedLang] = useState<"python" | "node" | "curl">("python");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const pythonSnippet = `from sentinelops import SentinelOps

# 1. Initialize client with your Agent API Key
sentinel = SentinelOps(
    api_key="sop_live_your_agent_key_here",
    base_url="https://sentinelops.dev"  # or http://localhost:3000 for local dev
)

# 2. Evaluate policy before executing any consequential action
decision = sentinel.evaluate(
    agent_id="sales-rep-01",
    agent_name="Enterprise Sales Agent",
    action="salesforce.account.update",
    resource="accounts/0015000000XyZ12",
    environment="production",
    context={
        "field": "annual_contract_value",
        "old_val": 45000,
        "new_val": 120000,
        "discount_percent": 25
    }
)

# 3. Handle sub-20ms policy engine decision
if decision.approved:
    # Action complies with active policies
    print("Action allowed by Zero-Trust policy engine.")
    # execute_mutation(...)
    
    # 4. Report outcome telemetry for the cryptographic audit trail
    sentinel.report_outcome(
        decision.request_id,
        status="succeeded",
        summary="Updated ARR on Salesforce account 0015000000XyZ12"
    )

elif decision.pending:
    # Consequential action intercepted! Awaiting human sign-off.
    print(f"Action routed for human review. Request ID: {decision.request_id}")
    
    # Poll until authorized operator approves or denies
    resolved_decision = sentinel.poll(decision.request_id, timeout_seconds=300)
    
    if resolved_decision.approved:
        # Operator approved in dashboard
        # execute_mutation(...)
        sentinel.report_outcome(
            decision.request_id,
            status="succeeded",
            summary="Executed after operator approval"
        )
    else:
        print(f"Operator denied action: {resolved_decision.reason}")

else:
    # Blocked immediately by automated guardrail policy
    print(f"Action blocked by policy: {decision.reason}")`;

  const pythonDecoratorSnippet = `from sentinelops import SentinelOps

sentinel = SentinelOps(api_key="sop_live_your_agent_key_here")

# Wrap your agent tool / function directly with the @guard decorator
@sentinel.guard(
    agent_id="sales-rep-01",
    agent_name="Enterprise Sales Agent",
    action="slack.channel.broadcast"
)
def broadcast_deal_close(customer_name: str, deal_size_usd: float):
    """Executes only when evaluated and approved by SentinelOps."""
    slack_client.chat_postMessage(
        channel="#sales-wins",
        text=f"Closed {customer_name} for \${deal_size_usd:,.2f}!"
    )
    return {"status": "broadcasted"}

# Calling this automatically performs evaluate -> poll -> execute -> report_outcome
broadcast_deal_close(customer_name="Acme Corp", deal_size_usd=120000)`;

  const nodeSnippet = `// Install official SDK: npm install @sentinelops/sdk
import { SentinelOps } from "@sentinelops/sdk";

// 1. Initialize client
const sentinel = new SentinelOps({
  apiKey: process.env.SENTINELOPS_API_KEY, // Or pass directly
});

// 2. Evaluate policy before executing any consequential action
const decision = await sentinel.evaluate({
  agentId: "customer-support-bot",
  action: "stripe.charges.refund",
  resource: "stripe/ch_3MtwLwLkdIwHu7ix28a30q",
  environment: "production",
  riskHint: "medium",
  context: { amount: 450, currency: "USD", reason: "duplicate_charge" },
});

if (decision.allowed) {
  // Safe to execute immediately
  await stripe.refunds.create({ charge: "ch_3MtwLwLkdIwHu7ix28a30q" });
  await sentinel.reportOutcome(decision.requestId, { status: "succeeded" });
} else if (decision.pending) {
  // Consequential action halted for 4-Eyes dual approval in Slack / Dashboard
  console.log("Awaiting human review in Slack (#sec-approvals)...");
  const approved = await sentinel.pollApproval(decision.requestId);
  if (approved.allowed) {
    await stripe.refunds.create({ charge: "ch_3MtwLwLkdIwHu7ix28a30q" });
    await sentinel.reportOutcome(decision.requestId, { status: "succeeded" });
  }
} else {
  console.error("Action blocked by Zero-Trust policy:", decision.reason);
}`;

  const curlSnippet = `# 1. Intercept & Evaluate Mutation via REST API
curl -X POST "https://sentinelops.dev/api/v1/actions/evaluate" \\
  -H "Authorization: Bearer sop_live_your_agent_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "idempotencyKey": "unique-mutation-uuid-001",
    "agent": {
      "externalId": "db-migration-agent",
      "name": "Database Schema Bot",
      "ownerEmail": "platform@company.com",
      "team": "Platform Engineering",
      "provider": "OpenAI"
    },
    "action": "postgres.schema.alter",
    "resource": "database/production_users",
    "environment": "production",
    "context": {
      "statement": "ALTER TABLE users ADD COLUMN sso_org_id VARCHAR(64);",
      "migration_id": "20260904_add_sso"
    }
  }'

# Expected Response (Sub-20ms Evaluation):
# {
#   "status": "pending_approval",
#   "requestId": "req_8f0f754d9cfb42f5",
#   "risk": "high",
#   "reason": "Production schema alterations require human operator sign-off",
#   "pollUrl": "/api/v1/actions/req_8f0f754d9cfb42f5/status"
# }`;

  return (
    <div className="min-h-screen bg-sentinel-canvas font-sentinel text-sentinel-text">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-50 border-b border-sentinel-line/80 bg-sentinel-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 rounded-lg border border-sentinel-line bg-sentinel-surface px-2.5 py-1 text-xs font-semibold text-sentinel-muted hover:text-sentinel-text transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Dashboard</span>
            </Link>
            <div className="flex items-center gap-2 border-l border-sentinel-line pl-3">
              <BrandMark small />
              <span className="text-xs font-bold text-sentinel-text">
                Documentation <span className="text-sentinel-lime font-mono">/</span> Connecting Agents
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard?view=credentials"
              className="secondary-button text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <KeyRound className="h-3.5 w-3.5 text-sentinel-lime" />
              <span className="hidden sm:inline">Get Agent API Key</span>
              <span className="sm:hidden">API Keys</span>
            </Link>
            <Link
              href="/dashboard?view=overview"
              className="primary-button text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <Bot className="h-3.5 w-3.5" />
              <span>Launch Control Center</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        {/* Title Header */}
        <div className="border-b border-sentinel-line pb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-sentinel-lime/30 bg-sentinel-lime/10 px-3 py-1 text-xs font-semibold text-sentinel-lime uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            Zero-Trust Gateway Integration
          </div>
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-sentinel-text">
            Connecting Autonomous AI Agents to SentinelOps
          </h1>
          <p className="mt-3 max-w-3xl text-sm sm:text-base leading-relaxed text-sentinel-muted">
            Intercept every consequential mutation before it touches production. Integrate real-time sub-20ms policy enforcement, multi-party human approval quorums, and cryptographic audit logging into your Python, Node.js, and REST-based agent fleet.
          </p>
        </div>

        {/* 3 Step Overview Ribbon */}
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="grid h-8 w-8 place-items-center rounded-xl border border-sentinel-lime/30 bg-sentinel-lime/10 font-mono text-xs font-bold text-sentinel-lime">
                01
              </span>
              <KeyRound className="h-4 w-4 text-sentinel-muted" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-sentinel-text">Issue Agent Credential</h3>
            <p className="mt-1 text-xs text-sentinel-muted leading-relaxed">
              Generate a scoped Agent API Key (`sop_live_...`) with least-privilege team boundaries from your SentinelOps credentials vault.
            </p>
          </div>

          <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="grid h-8 w-8 place-items-center rounded-xl border border-sentinel-accent/30 bg-sentinel-accent/10 font-mono text-xs font-bold text-sentinel-accent">
                02
              </span>
              <ShieldCheck className="h-4 w-4 text-sentinel-muted" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-sentinel-text">Evaluate Sub-20ms Policies</h3>
            <p className="mt-1 text-xs text-sentinel-muted leading-relaxed">
              Wrap actions with `@sentinel.guard` or call `/api/v1/actions/evaluate` prior to calling APIs, executing SQL, or modifying resources.
            </p>
          </div>

          <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="grid h-8 w-8 place-items-center rounded-xl border border-amber-400/30 bg-amber-400/10 font-mono text-xs font-bold text-amber-400">
                03
              </span>
              <Layers className="h-4 w-4 text-sentinel-muted" />
            </div>
            <h3 className="mt-3 text-sm font-bold text-sentinel-text">Human-in-the-Loop & Audit</h3>
            <p className="mt-1 text-xs text-sentinel-muted leading-relaxed">
              High-risk mutations trigger approval queues for authorized reviewers. All execution outcomes are sealed in a SHA-256 hash chain.
            </p>
          </div>
        </section>

        {/* Live Interactive Zero-Trust Policy Sandbox */}
        <section className="mt-10">
          <InteractivePolicySandbox />
        </section>

        {/* Code Snippets & Language Selector */}
        <section className="mt-10 rounded-2xl border border-sentinel-line bg-sentinel-surface shadow-md overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-sentinel-line bg-sentinel-surface-raised/50 px-5 py-3.5 gap-3">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-sentinel-lime" />
              <span className="text-xs font-bold uppercase tracking-wider text-sentinel-text">
                Quick Integration Snippets
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-xl border border-sentinel-line bg-sentinel-canvas/70 p-1">
              <button
                type="button"
                onClick={() => setSelectedLang("python")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  selectedLang === "python"
                    ? "bg-sentinel-surface text-sentinel-lime shadow-sm"
                    : "text-sentinel-muted hover:text-sentinel-text"
                }`}
              >
                Python SDK
              </button>
              <button
                type="button"
                onClick={() => setSelectedLang("node")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  selectedLang === "node"
                    ? "bg-sentinel-surface text-sentinel-lime shadow-sm"
                    : "text-sentinel-muted hover:text-sentinel-text"
                }`}
              >
                TypeScript / Node
              </button>
              <button
                type="button"
                onClick={() => setSelectedLang("curl")}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                  selectedLang === "curl"
                    ? "bg-sentinel-surface text-sentinel-lime shadow-sm"
                    : "text-sentinel-muted hover:text-sentinel-text"
                }`}
              >
                cURL / REST API
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            {selectedLang === "python" && (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-sentinel-text flex items-center gap-2">
                      <Terminal className="h-3.5 w-3.5 text-sentinel-muted" />
                      1. Install the Python SDK
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy("pip install sentinelops-ai", "pip")}
                      className="text-[11px] text-sentinel-muted hover:text-sentinel-text flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === "pip" ? <Check className="h-3 w-3 text-sentinel-lime" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === "pip" ? "Copied!" : "Copy"}</span>
                    </button>
                  </div>
                  <pre className="rounded-xl border border-sentinel-line/80 bg-sentinel-canvas p-3 font-mono text-xs text-sentinel-lime overflow-x-auto">
                    pip install sentinelops-ai
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-sentinel-text flex items-center gap-2">
                      <FileCode className="h-3.5 w-3.5 text-sentinel-muted" />
                      2. Evaluate, Poll & Report Outcome Pattern
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(pythonSnippet, "py-main")}
                      className="text-[11px] text-sentinel-muted hover:text-sentinel-text flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === "py-main" ? <Check className="h-3 w-3 text-sentinel-lime" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === "py-main" ? "Copied!" : "Copy Code"}</span>
                    </button>
                  </div>
                  <pre className="rounded-xl border border-sentinel-line/80 bg-sentinel-canvas p-4 font-mono text-xs text-sentinel-text/90 overflow-x-auto leading-relaxed">
                    {pythonSnippet}
                  </pre>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-sentinel-text flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-sentinel-lime" />
                      3. Decorator Pattern (@sentinel.guard)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(pythonDecoratorSnippet, "py-dec")}
                      className="text-[11px] text-sentinel-muted hover:text-sentinel-text flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey === "py-dec" ? <Check className="h-3 w-3 text-sentinel-lime" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === "py-dec" ? "Copied!" : "Copy Code"}</span>
                    </button>
                  </div>
                  <pre className="rounded-xl border border-sentinel-line/80 bg-sentinel-canvas p-4 font-mono text-xs text-sentinel-text/90 overflow-x-auto leading-relaxed">
                    {pythonDecoratorSnippet}
                  </pre>
                </div>
              </div>
            )}

            {selectedLang === "node" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-sentinel-text flex items-center gap-2">
                    <FileCode className="h-3.5 w-3.5 text-sentinel-muted" />
                    Native TypeScript & Node.js HTTP Evaluation
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(nodeSnippet, "node")}
                    className="text-[11px] text-sentinel-muted hover:text-sentinel-text flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "node" ? <Check className="h-3 w-3 text-sentinel-lime" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === "node" ? "Copied!" : "Copy Code"}</span>
                  </button>
                </div>
                <pre className="rounded-xl border border-sentinel-line/80 bg-sentinel-canvas p-4 font-mono text-xs text-sentinel-text/90 overflow-x-auto leading-relaxed">
                  {nodeSnippet}
                </pre>
              </div>
            )}

            {selectedLang === "curl" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-sentinel-text flex items-center gap-2">
                    <Terminal className="h-3.5 w-3.5 text-sentinel-muted" />
                    Direct HTTP / REST API Command
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(curlSnippet, "curl")}
                    className="text-[11px] text-sentinel-muted hover:text-sentinel-text flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "curl" ? <Check className="h-3 w-3 text-sentinel-lime" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedKey === "curl" ? "Copied!" : "Copy Command"}</span>
                  </button>
                </div>
                <pre className="rounded-xl border border-sentinel-line/80 bg-sentinel-canvas p-4 font-mono text-xs text-sentinel-text/90 overflow-x-auto leading-relaxed">
                  {curlSnippet}
                </pre>
              </div>
            )}
          </div>
        </section>

        {/* Framework Adapters & Best Practices */}
        <section className="mt-12 space-y-8">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-sentinel-text">
              Popular Framework Integration Patterns
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-sentinel-muted">
              SentinelOps seamlessly wraps tools and actions in LangChain, LlamaIndex, CrewAI, and AutoGen.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-6">
              <h3 className="text-base font-bold text-sentinel-text flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sentinel-lime" />
                LangChain Tool Wrapper
              </h3>
              <p className="mt-2 text-xs text-sentinel-muted leading-relaxed">
                Intercept LangChain `@tool` or `BaseTool` instances by evaluating arguments through SentinelOps before running the function.
              </p>
              <pre className="mt-4 rounded-xl border border-sentinel-line bg-sentinel-canvas p-3 font-mono text-[11px] text-sentinel-text/90 overflow-x-auto">
{`from langchain.tools import tool

@tool
def execute_sql_query(query: str) -> str:
    """Executes SQL against analytical warehouse."""
    decision = sentinel.evaluate(
        agent_id="langchain-analyst",
        action="database.sql.query",
        resource="postgres/analytics",
        context={"query": query}
    )
    if not decision.approved:
        return f"Query rejected: {decision.reason}"
    return db.execute(query)`}
              </pre>
            </div>

            <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-6">
              <h3 className="text-base font-bold text-sentinel-text flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-sentinel-accent" />
                CrewAI Task Guardrail
              </h3>
              <p className="mt-2 text-xs text-sentinel-muted leading-relaxed">
                Equip CrewAI agent tools with dual-custody verification for high-impact outputs (e.g. drafting emails, executing payments).
              </p>
              <pre className="mt-4 rounded-xl border border-sentinel-line bg-sentinel-canvas p-3 font-mono text-[11px] text-sentinel-text/90 overflow-x-auto">
{`from crewai.tools import tool

@tool("Send Invoice")
def send_invoice(client_id: str, amount: float) -> str:
    """Sends financial invoice to external client."""
    decision = sentinel.evaluate(
        agent_id="finance-crew-billing",
        action="billing.invoice.send",
        resource=f"clients/{client_id}",
        context={"amount": amount}
    )
    if decision.approved:
        return stripe.Invoice.create(...)
    return "Action queued for human approval"`}
              </pre>
            </div>
          </div>
        </section>

        {/* Security & Architecture Deep Dive */}
        <section className="mt-12 rounded-2xl border border-sentinel-line bg-sentinel-surface p-6 sm:p-8">
          <h2 className="text-lg sm:text-xl font-bold text-sentinel-text flex items-center gap-2.5">
            <Lock className="h-5 w-5 text-sentinel-lime" />
            Zero-Trust Architectural Guarantees
          </h2>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-5 text-xs text-sentinel-muted leading-relaxed">
            <div>
              <strong className="block text-sm font-semibold text-sentinel-text mb-1">
                Sub-20ms SLA
              </strong>
              In-memory state and optimized monotonic indexing guarantee policy evaluation completes in under 20 milliseconds without adding latency to agent workflows.
            </div>
            <div>
              <strong className="block text-sm font-semibold text-sentinel-text mb-1">
                Transitive Four-Eyes
              </strong>
              Makers cannot review their own requests. Out-of-Office (OOO) and delegator sign-off preserves non-repudiation and SOX/SOC-2 compliance.
            </div>
            <div>
              <strong className="block text-sm font-semibold text-sentinel-text mb-1">
                HMAC-SHA-256 Seal
              </strong>
              Every policy check, human approval, and reported outcome receives a cryptographically linked hash seal that prevents log tampering or deletion.
            </div>
          </div>
        </section>

        {/* Bottom Call to Action */}
        <section className="mt-12 mb-16 rounded-2xl border border-sentinel-lime/30 bg-gradient-to-r from-sentinel-lime/10 via-sentinel-surface to-sentinel-surface p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h3 className="text-lg font-bold text-sentinel-text">Ready to protect your agent fleet?</h3>
            <p className="mt-1 text-xs text-sentinel-muted">
              Register your agent in the dashboard and create an API key in under 60 seconds.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/dashboard?view=credentials"
              className="secondary-button text-xs py-2 px-4"
            >
              Create API Key
            </Link>
            <Link
              href="/dashboard?view=agents"
              className="primary-button text-xs py-2 px-4 flex items-center gap-2"
            >
              <Bot className="h-4 w-4" />
              <span>Register Agent</span>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
