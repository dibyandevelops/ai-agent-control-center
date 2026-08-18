"use client";

import { Check, Copy, ShieldCheck, Terminal } from "lucide-react";
import { useState } from "react";

const clientCode = `import json
import os
import time
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, Callable

class SentinelOpsError(Exception):
    pass

class SentinelOpsClient:
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or os.environ.get("SENTINELOPS_AGENT_API_KEY")
        self.base_url = (base_url or os.environ.get("SENTINELOPS_BASE_URL", "http://localhost:3000")).rstrip("/")
        if not self.api_key:
            raise SentinelOpsError("SentinelOps API Key must be provided or set in SENTINELOPS_AGENT_API_KEY.")

    def evaluate(self, action: str, resource: str, environment: str = "development", context: Optional[dict] = None) -> dict:
        payload = {
            "action": action,
            "resource": resource,
            "environment": environment,
            "context": context or {},
            "agent": {
                "externalId": "python-agent-client",
                "name": "Python Agent Client"
            }
        }
        url = f"{self.base_url}/api/v1/actions/evaluate"
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
                                     headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                                     method="POST")
        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as e:
            raise SentinelOpsError(f"Failed to communicate with SentinelOps: {str(e)}")

    def wait_for_decision(self, request_id: str, timeout_seconds: int = 60, poll_interval: float = 1.0) -> dict:
        url = f"{self.base_url}/api/v1/actions/{request_id}"
        headers = {"Authorization": f"Bearer {self.api_key}"}
        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            req = urllib.request.Request(url, headers=headers, method="GET")
            try:
                with urllib.request.urlopen(req) as response:
                    data = json.loads(response.read().decode("utf-8"))
                    if data.get("status") in ("approved", "denied"):
                        return data
            except Exception:
                pass
            time.sleep(poll_interval)
        raise SentinelOpsError("Decision polling timed out.")

    def guard(self, action: str, get_resource: Callable[..., str], get_context: Optional[Callable[..., dict]] = None):
        def decorator(func):
            def wrapper(*args, **kwargs):
                resource = get_resource(*args, **kwargs)
                context = get_context(*args, **kwargs) if get_context else {}
                decision = self.evaluate(action=action, resource=resource, context=context)
                status = decision.get("status")
                if status == "approved":
                    return func(*args, **kwargs)
                elif status == "pending":
                    print(f"Action '{action}' is pending approval. Waiting...")
                    details = self.wait_for_decision(decision.get("requestId"))
                    if details.get("status") == "approved":
                        return func(*args, **kwargs)
                    else:
                        raise SentinelOpsError(f"Action '{action}' was denied by operator.")
                else:
                    raise SentinelOpsError(f"Action '{action}' was denied immediately by Policy Engine.")
            return wrapper
        return decorator`;

const decoratorCode = `from sentinelops_client import SentinelOpsClient, SentinelOpsError

# Initialize client
client = SentinelOpsClient()

# Guard any critical python function
@client.guard(
    action="invoice.payment.prepare",
    get_resource=lambda inv_id, amount: f"invoice/{inv_id}",
    get_context=lambda inv_id, amount: {"amount": amount}
)
def process_payment(invoice_id: str, amount: float):
    # This block runs ONLY if SentinelOps approves the action
    print(f"Executing transfer for {invoice_id} of amount \${amount}.")

try:
    process_payment("INV-1042", 4250.0)
except SentinelOpsError as e:
    print(f"Action Blocked: {e}")`;

const manualCode = `from sentinelops_client import SentinelOpsClient, SentinelOpsError

# Initialize client
client = SentinelOpsClient()

# Evaluate action manually
decision = client.evaluate(
    action="deploy.release",
    resource="sentinelops/platform@v1.2.0",
    context={"changeTicket": "PROD-102"}
)

status = decision.get("status")

if status == "approved":
    execute_deployment()
elif status == "pending":
    print("Action requires operator approval. Waiting...")
    details = client.wait_for_decision(decision["requestId"], timeout_seconds=120)
    if details.get("status") == "approved":
        execute_deployment()
    else:
        print("Denied by operator.")
else:
    print("Denied immediately by Policy Engine.")`;

export function PythonSDKConnection() {
  const [activeTab, setActiveTab] = useState<"client" | "decorator" | "manual">("client");
  const [copied, setCopied] = useState(false);

  const activeSnippet =
    activeTab === "client" ? clientCode : activeTab === "decorator" ? decoratorCode : manualCode;

  async function copyToClipboard() {
    await navigator.clipboard.writeText(activeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-4 border-t border-sentinel-border pt-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-white">
        <Terminal className="h-4 w-4 text-sentinel-lime" />
        <span>Python SDK Quickstart & Connection Guide</span>
      </div>
      
      <p className="mt-2 text-[11px] leading-5 text-sentinel-muted">
        SentinelOps includes a Python helper client designed to secure autonomous AI agents. Copy the helper class and select your integration pattern below.
      </p>

      {/* Tab Menu */}
      <div className="mt-3 flex items-center justify-between border-b border-sentinel-border bg-sentinel-canvas/30 px-3 py-1">
        <div className="flex items-center gap-1">
          {[
            { id: "client", label: "1. SentinelOpsClient Helper" },
            { id: "decorator", label: "2. Function Decorator Guard" },
            { id: "manual", label: "3. Autonomous Agent Loop" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as "client" | "decorator" | "manual");
                setCopied(false);
              }}
              className={`px-3 py-2 text-[10px] font-semibold transition ${
                activeTab === tab.id
                  ? "border-b-2 border-sentinel-lime text-white"
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
      <div className="relative mt-2 rounded bg-sentinel-canvas/70 p-3 font-mono text-[10px] leading-5 text-sentinel-text">
        <pre className="max-h-[250px] overflow-auto">
          <code>{activeSnippet}</code>
        </pre>
      </div>

      {/* Helper Alert */}
      <div className="mt-3 flex items-start gap-2.5 rounded border border-sentinel-lime/20 bg-sentinel-lime/5 p-2.5 text-[11px] leading-4 text-sentinel-muted">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sentinel-lime" />
        <div>
          <span>Ensure you have generated an API key on the Credentials page and configured it locally:</span>
          <pre className="mt-1 font-mono text-[9px] text-white">export SENTINELOPS_AGENT_API_KEY=&quot;your-api-key&quot;</pre>
        </div>
      </div>
    </div>
  );
}
