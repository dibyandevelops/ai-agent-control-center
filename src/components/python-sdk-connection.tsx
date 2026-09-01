"use client";

import { Check, Copy, ShieldCheck, Terminal } from "lucide-react";
import { useState } from "react";

const quickstartCode = `# 1. Install SDK
# pip install sentinelops-ai

from sentinelops import SentinelOps

# Initialize client (reads SENTINELOPS_API_KEY from environment)
sentinel = SentinelOps()

# Submit an action for policy evaluation
decision = sentinel.evaluate(
    agent_id="payment-agent",
    agent_name="Payment Processing Agent",
    action="invoice.payment.prepare",
    resource="invoice/INV-1042",
    context={"amount": 4250.0, "currency": "USD"},
)

if decision.approved:
    print("✅ Action approved by policy engine. Executing...")
    # Execute your action here
    sentinel.report_outcome(
        decision.request_id,
        status="succeeded",
        summary="Payment processed successfully",
    )
elif decision.pending:
    print("⏳ Action requires human approval. Waiting for operator...")
    decision = sentinel.poll(decision.request_id, timeout=300)
    if decision.approved:
        print("✅ Approved by operator! Executing...")
        sentinel.report_outcome(
            decision.request_id,
            status="succeeded",
            summary="Payment processed after operator sign-off",
        )
else:
    print(f"⛔ Action blocked by policy: {decision.reason}")`;

const decoratorCode = `# 1. Install SDK
# pip install sentinelops-ai

from sentinelops import SentinelOps

sentinel = SentinelOps()

# Guard any critical agent tool or function
@sentinel.guard(
    agent_id="sales-bot",
    agent_name="Sales Outreach Agent",
    action="send_email",
)
def send_outreach_email(prospect_email: str, subject: str, body: str):
    # This block executes ONLY if SentinelOps allows or operator approves
    print(f"Sending email to {prospect_email}...")
    return {"sent": True}

# Call function as usual — evaluation, approval polling & outcome reporting happen automatically
send_outreach_email("sarah.chen@techcorp.io", "Partnership Inquiry", "Hi Sarah...")`;

const testScriptCode = `# Verify your API key and live connection
export SENTINELOPS_API_KEY="sop_live_your_api_key_here"

# From the sdk/python directory:
python examples/test_connection.py`;

export function PythonSDKConnection() {
  const [activeTab, setActiveTab] = useState<"quickstart" | "decorator" | "test">("quickstart");
  const [copied, setCopied] = useState(false);

  const activeSnippet =
    activeTab === "quickstart" ? quickstartCode : activeTab === "decorator" ? decoratorCode : testScriptCode;

  async function copyToClipboard() {
    await navigator.clipboard.writeText(activeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="col-span-full mt-4 border-t border-sentinel-border pt-4" style={{ gridColumn: "1 / -1" }}>
      <div className="flex items-center gap-2 text-xs font-semibold text-white">
        <Terminal className="h-4 w-4 text-sentinel-lime" />
        <span>Python SDK Quickstart & Connection Guide</span>
      </div>
      
      <p className="mt-2 text-[11px] leading-5 text-sentinel-muted font-normal">
        SentinelOps includes a Python helper client designed to secure autonomous AI agents. Copy the helper class and select your integration pattern below.
      </p>

      {/* Tab Menu */}
      <div className="mt-4 flex items-center justify-between border-b border-sentinel-border bg-sentinel-canvas/20 px-1 py-1 rounded">
        <div className="flex items-center gap-1">
          {[
            { id: "quickstart", label: "1. Quickstart" },
            { id: "decorator", label: "2. @guard Decorator" },
            { id: "test", label: "3. Connection Test" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as "quickstart" | "decorator" | "test");
                setCopied(false);
              }}
              className={`rounded px-2.5 py-1.5 text-[10px] font-semibold transition ${
                activeTab === tab.id
                  ? "bg-sentinel-raised text-white shadow-sm"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={copyToClipboard}
          className="inline-flex h-7 items-center gap-1.5 rounded border border-sentinel-border px-2 text-[10px] font-semibold text-sentinel-muted transition hover:border-sentinel-line-strong hover:text-sentinel-text"
        >
          {copied ? <Check className="h-3 w-3 text-sentinel-lime" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied!" : "Copy Snippet"}
        </button>
      </div>

      {/* Code Area */}
      <div className="relative mt-2 rounded bg-sentinel-canvas/50 border border-sentinel-border/50 p-3 font-mono text-[10px] leading-5 text-sentinel-text">
        <pre className="max-h-[250px] overflow-x-auto whitespace-pre font-mono text-[10px] leading-5 text-sentinel-text">
          <code>{activeSnippet}</code>
        </pre>
      </div>

      {/* Helper Alert */}
      <div className="mt-3 flex items-start gap-2.5 rounded border border-sentinel-lime/20 bg-sentinel-lime/5 p-2.5 text-[10px] leading-4 text-sentinel-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sentinel-lime" />
        <div>
          <span>Ensure you have generated an API key on the Credentials page and configured it locally:</span>
          <pre className="mt-1 font-mono text-[9px] text-white">export SENTINELOPS_AGENT_API_KEY=&quot;your-api-key&quot;</pre>
        </div>
      </div>
    </div>
  );
}
