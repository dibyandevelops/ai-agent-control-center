# Connect Your First AI Agent in 5 Minutes

This guide takes you from zero to a working SentinelOps integration.
By the end, you'll see a real agent action appear in your dashboard.

---

## Prerequisites

- A SentinelOps account at [trysentinelops.com](https://trysentinelops.com)
- Python 3.9 or later
- An AI agent you want to govern (or use our test script)

---

## Step 1: Create an API Key

1. Log in to your SentinelOps dashboard
2. Go to **Settings → Credentials**
3. Click **Create API Key**
4. Name it something descriptive (e.g. `"sales-bot-production"`)
5. Copy the key — it starts with `sop_live_`

> **Important:** Save this key somewhere safe. You won't be able to see it again.

---

## Step 2: Install the SDK

```bash
pip install sentinelops-ai
```

---

## Step 3: Test Your Connection

Before integrating into your agent, verify everything works:

```bash
export SENTINELOPS_API_KEY=sop_live_your_key_here
python examples/test_connection.py
```

You should see:

```
  SentinelOps Connection Test
  ========================================

  ✓ Client created
  ✓ Connected to SentinelOps (My Organization)
  ✓ Test action evaluated: ALLOWED (risk: low)
  ✓ Execution outcome reported: succeeded

  ----------------------------------------
  ✓ Full round-trip complete — your integration is working!
```

---

## Step 4: Add Governance to Your Agent

Add these lines before any action your agent takes:

```python
from sentinelops import SentinelOps

# Create the client (reads SENTINELOPS_API_KEY from env)
sentinel = SentinelOps()

# Before your agent sends an email, makes an API call, etc:
decision = sentinel.evaluate(
    agent_id="my-agent",
    agent_name="My AI Agent",
    action="send_email",
    resource="customer@example.com",
    context={"subject": "Follow up on our conversation"},
)

if decision.approved:
    # ✅ Safe to proceed
    send_email(to="customer@example.com", ...)

    # Tell SentinelOps how it went
    sentinel.report_outcome(
        decision.request_id,
        status="succeeded",
        summary="Email sent to customer@example.com",
    )
else:
    # ⛔ Blocked by policy or pending approval
    print(f"Action not approved: {decision.reason}")
```

---

## Step 5: Check Your Dashboard

Go to your SentinelOps dashboard. You'll see:

- The agent registered in the **Agents** tab
- The action in the **Audit Log**
- If the action needed approval, it appears in the **Approvals** queue

---

## What Happens Under the Hood

```
Your Agent                    SentinelOps                    Dashboard
    │                              │                              │
    │── evaluate(send_email) ─────►│                              │
    │                              │── check policies             │
    │                              │── assign risk level          │
    │                              │── record in audit log ──────►│
    │◄── Decision(allowed) ───────│                              │
    │                              │                              │
    │── [execute the action] ──►   │                              │
    │                              │                              │
    │── report_outcome(succeeded)─►│                              │
    │                              │── update audit log ─────────►│
    │                              │                              │
```

---

## Using the Decorator (Simpler)

If you want less boilerplate:

```python
from sentinelops import SentinelOps

sentinel = SentinelOps()

@sentinel.guard(
    agent_id="sales-bot",
    agent_name="Sales Outreach Agent",
    action="send_email",
)
def send_cold_email(to: str, subject: str, body: str):
    # This only runs if SentinelOps approves the action
    email_client.send(to=to, subject=subject, body=body)
    return {"sent": True}

# Just call the function — governance is handled automatically
send_cold_email("prospect@company.com", "Hello!", "Let's chat.")
```

The decorator handles the entire lifecycle:
1. Calls `evaluate()` before your function runs
2. If pending, polls until a human approves
3. Runs your function only if approved
4. Calls `report_outcome()` with the result (or the error if it fails)

---

## Handling Pending Approvals

If your policy requires human approval for certain actions:

```python
decision = sentinel.evaluate(
    agent_id="finance-bot",
    agent_name="Finance Agent",
    action="transfer_funds",
    resource="vendor-account-123",
    context={"amount": 50000, "currency": "USD"},
)

if decision.pending:
    print("⏳ Waiting for manager approval...")

    # Poll every 5 seconds, up to 10 minutes
    decision = sentinel.poll(
        decision.request_id,
        timeout=600,
        interval=5,
    )

if decision.approved:
    transfer_funds(...)
```

---

## Next Steps

- **Create policies** in the dashboard to control which actions need approval
- **Set up Slack notifications** so your team gets pinged for approval requests
- **Review the audit log** to see everything your agents are doing
