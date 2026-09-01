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
| `status` | `str` | `allowed`, `pending`, `approved`, `denied`, `blocked` |
| `approved` | `bool` | `True` if safe to execute |
| `pending` | `bool` | `True` if awaiting human review |
| `blocked` | `bool` | `True` if denied or blocked |
| `reason` | `str` | Why the decision was made |
| `risk` | `str` | `low`, `medium`, or `high` |

## License

MIT
