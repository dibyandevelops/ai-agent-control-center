# SentinelOps Python Integration Guide

This guide describes how to connect and protect your Python-based AI agents (such as LangChain, AutoGen, CrewAI, or custom LLM loops) using the SentinelOps policy engine.

---

## 1. Quickstart with `SentinelOpsClient`

SentinelOps provides a sleek, lightweight Python client wrapper in [`examples/sentinelops_client.py`](../examples/sentinelops_client.py).

### Installation
Copy the `sentinelops_client.py` file into your project or import it directly:

```python
from examples.sentinelops_client import SentinelOpsClient, SentinelOpsError
```

### Initializing the Client
You can initialize the client by explicitly passing credentials or letting it read from environment variables:

```python
# Option A: Automatic configuration (Recommended)
# Expects:
#   export SENTINELOPS_AGENT_API_KEY="sop_key_..."
#   export SENTINELOPS_BASE_URL="https://ai-agent-control-center-alpha.vercel.app"
client = SentinelOpsClient()

# Option B: Explicit configuration
client = SentinelOpsClient(
    api_key="sop_key_your_api_key_here",
    base_url="https://ai-agent-control-center-alpha.vercel.app"
)
```

---

## 2. Integration Patterns

SentinelOps supports two main patterns of Python agent integrations:

### Pattern A: Decorator Guards (Automatic Enforcement)
The easiest way to secure critical agent actions is to wrap functions using the `@client.guard` decorator. The decorator interceptor evaluates policies, handles pending states, polls for operator input, and enforces decisions transparently.

```python
# Lambda mapping extracts resource ID and runtime context dynamically from function arguments
@client.guard(
    action="invoice.payment.prepare",
    get_resource=lambda inv_id, amount: f"invoice/{inv_id}",
    get_context=lambda inv_id, amount: {"amount": amount}
)
def process_payment(invoice_id: str, amount: float):
    # This block executes ONLY if approved by SentinelOps
    print(f"Executing bank transfer for {invoice_id} of amount ${amount}.")

# Run-time execution
try:
    process_payment("INV-1042", 4250.0)
except SentinelOpsError as e:
    # Triggers if the operator denies the action or policy blocks it
    print(f"Action Blocked: {e}")
```

### Pattern B: Manual Policy Check (Custom Agentic Loops)
For autonomous agents that decide how to handle policy responses programmatically, call `.evaluate()` directly:

```python
decision = client.evaluate(
    action="deploy.release",
    resource="sentinelops/platform@v1.2.0",
    context={"changeTicket": "PROD-102"}
)

status = decision.get("status")

if status == "approved":
    # Safe to execute release immediately
    execute_deployment()
elif status == "pending":
    # Notify agent state or pause execution to poll SentinelOps
    print(f"Action requires operator approval (Request ID: {decision['requestId']})")
    
    # Block and poll until an operator approves/denies via Slack/Dashboard
    try:
        details = client.wait_for_decision(decision["requestId"], timeout_seconds=120)
        if details.get("decision", {}).get("status") == "approved":
            execute_deployment()
        else:
            abort_deployment("Denied by operator.")
    except SentinelOpsError as e:
        abort_deployment(f"Verification timeout: {e}")
else:
    abort_deployment("Denied immediately by Policy Engine.")
```

---

## 3. Reference: Environment Variables

| Variable Name | Description | Default |
| :--- | :--- | :--- |
| `SENTINELOPS_AGENT_API_KEY` | Secret client API Key generated from SentinelOps Dashboard. | *Required* |
| `SENTINELOPS_BASE_URL` | Base URL of the deployed SentinelOps dashboard. | `http://localhost:3000` |
