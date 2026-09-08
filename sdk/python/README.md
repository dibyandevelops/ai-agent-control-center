# SentinelOps Python SDK

Human-in-the-loop governance for AI agents.

SentinelOps sits between your AI agent and every action it takes —
evaluating policies, routing high-risk actions to human reviewers, and
recording an immutable audit log of every decision.

## Install

```bash
pip install sentinelops-ai
```

## Quick Start

```python
from sentinelops import SentinelOps

sentinel = SentinelOps(api_key="sop_live_...")

# Before your agent takes any action:
decision = sentinel.evaluate(
    agent_id="sales-bot",
    agent_name="Sales Outreach Agent",
    action="send_email",
    resource="prospect@company.com",
    environment="production",
    context={"subject": "Partnership opportunity"},
)

if decision.approved:
    # Safe to proceed
    send_email(to="prospect@company.com", ...)

    # Tell SentinelOps how it went
    sentinel.report_outcome(
        decision.request_id,
        status="succeeded",
        summary="Email sent successfully",
    )

elif decision.pending:
    # A human needs to approve this — wait for it
    decision = sentinel.poll(decision.request_id, timeout=300)

    if decision.approved:
        send_email(...)
        sentinel.report_outcome(
            decision.request_id,
            status="succeeded",
            summary="Email sent after approval",
        )

else:
    print(f"Action blocked: {decision.reason}")
```

## Decorator Pattern

For a cleaner integration, use the `@sentinel.guard` decorator:

```python
sentinel = SentinelOps(api_key="sop_live_...")

@sentinel.guard(
    agent_id="sales-bot",
    agent_name="Sales Outreach Agent",
    action="send_email",
)
def send_cold_email(to: str, subject: str, body: str):
    """This function only runs if SentinelOps approves the action."""
    email_client.send(to=to, subject=subject, body=body)
    return {"sent": True}

# The decorator handles evaluate → poll → execute → report_outcome
send_cold_email("prospect@company.com", "Hello!", "Let's chat.")
```

## Configuration

```python
# Option 1: Pass the API key directly
sentinel = SentinelOps(api_key="sop_live_...")

# Option 2: Use environment variables
# export SENTINELOPS_API_KEY=sop_live_...
# export SENTINELOPS_BASE_URL=https://trysentinelops.com  (optional)
sentinel = SentinelOps()

# Option 3: Point to a local development server
sentinel = SentinelOps(
    api_key="sop_live_...",
    base_url="http://localhost:3000",
)
```

## API Reference

### `SentinelOps(api_key, base_url, timeout)`

Create a new client.

### `sentinel.evaluate(**kwargs) → Decision`

Submit an action for policy evaluation.

### `sentinel.poll(request_id, timeout, interval) → Decision`

Wait for a pending human approval to resolve.

### `sentinel.report_outcome(request_id, status, summary, ...)`

Report the execution result back to SentinelOps.

### `Decision`

| Property | Type | Description |
|---|---|---|
| `request_id` | `str` | Unique action request ID |
| `status` | `str` | `allowed`, `pending`, `approved`, `denied`, `blocked`, `quarantined` |
| `approved` | `bool` | `True` if safe to execute |
| `pending` | `bool` | `True` if awaiting human review |
| `blocked` | `bool` | `True` if denied or blocked |
| `quarantined` | `bool` | `True` if agent is isolated under emergency fleet quarantine |
| `undo_window_seconds` | `int` | Reversible undo grace period (0 when irreversibly dispatched) |
| `sha256_seal` | `str \| None` | Immutable SHA-256 audit anchor for SOC 2 & ISO 27001 proof |
| `reason` | `str` | Why the decision was made |

## Advanced Governance Features

### 1. Emergency Fleet Quarantine Kill-Switch
When security teams isolate a rogue or compromised agent from the SentinelOps control plane, all tool calls are blocked in **<4ms** at the gateway layer. The Python SDK raises `AgentQuarantinedError`:

```python
from sentinelops import SentinelOps, AgentQuarantinedError

try:
    decision = sentinel.evaluate(agent_id="scraper-bot", action="export_db")
except AgentQuarantinedError as e:
    # Agent permissions have been stripped by security operators
    logger.critical("Agent is quarantined by SentinelOps! Request %s", e.request_id)
```

### 2. Interactive 5-Second Undo Grace Period
When an operator approves an action in Slack or the web dashboard, SentinelOps holds execution in a 5-second reversible buffer. `sentinel.poll()` automatically ensures the undo window has safely elapsed before returning `decision.approved = True`, guaranteeing downstream tools never trigger on accidental clicks.

## Examples

The SDK includes production-ready example scripts in the `examples/` directory:

### 1. Governed Enterprise Sales Representative (`sales_representative_agent.py`)

A full implementation of the **Orkestrate Sales Assistant** featuring:
- **Mandatory 3-step internal reasoning protocol** before any tool execution (Customer Intent, Scope Authorization, Risk Assessment).
- **Hard pricing policy guardrails**:
  - $\le 15\%$ standard annual contract discount $\rightarrow$ automatically allowed.
  - $15\% - 30\%$ custom discount $\rightarrow$ routes to SentinelOps for 4-Eyes Human Operator approval.
  - $> 30\%$ discount $\rightarrow$ strictly rejected by policy.
- **Anti-Prompt-Injection** and adversarial input sanitization.
- **Interactive Terminal Chat** and automated scenario testing.

```bash
# Run automated scenarios against local SentinelOps
python examples/sales_representative_agent.py --scenarios

# Run interactive chat mode
python examples/sales_representative_agent.py --interactive
```

### 2. Autonomous Cloud Infrastructure SRE Bot (`devops_sre_agent.py`)

A full production simulation of an autonomous DevOps SRE Agent demonstrating:
- **Routine Low-Risk Scaling**: Kubernetes deployment scaled from 3 to 5 replicas (auto-approved in sub-20ms).
- **High-Consequence Terraform Teardown**: Destructive cluster teardown intercepted for 4-Eyes dual sign-off with a 5-second Undo grace period.
- **Rogue / Quarantined Agent Containment**: Immediate sub-4ms block when a rogue agent attempts backup archive purge under active quarantine.

```bash
python examples/devops_sre_agent.py
```

### 3. Autonomous Sales Outreach Bot (`demo_sales_agent.py`)

Simulates background outreach with lead qualification, email drafting, and CRM sync.

```bash
python examples/demo_sales_agent.py
```

### 4. Connection Diagnostics (`test_connection.py`)

Verify connectivity, API key authentication, and audit round-trips.

```bash
python examples/test_connection.py
```

## License

MIT
