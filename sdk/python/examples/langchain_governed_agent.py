"""Example: LangChain Autonomous Agent with SentinelOps Zero-Trust Governance.

This script demonstrates how an enterprise autonomous agent using LangChain
tools is governed by SentinelOps:
- Low-risk read actions are evaluated in sub-20ms and allowed automatically.
- High-risk actions (e.g. database mutations, payments, cloud deployments)
  are held for human-in-the-loop approval or blocked by organization policy.
- Full cryptographic SHA-256 evidence is recorded for tamper-evident auditing.

Usage:
    export SENTINELOPS_API_KEY="sop_live_..."
    python langchain_governed_agent.py
"""

import os
from sentinelops import SentinelOps
from sentinelops.langchain import SentinelOpsCallbackHandler

# 1. Initialize SentinelOps client
api_key = os.environ.get("SENTINELOPS_API_KEY", "sop_live_demo_key_12345")
base_url = os.environ.get("SENTINELOPS_BASE_URL", "https://sentinelops-ai.com")

sentinel = SentinelOps(api_key=api_key, base_url=base_url)

# 2. Attach SentinelOps Callback Handler
callback_handler = SentinelOpsCallbackHandler(
    client=sentinel,
    agent_id="enterprise-devops-agent",
    agent_name="DevOps Autopilot Agent",
    environment="production",
    team="Platform Infrastructure",
    owner_email="iruka@sentinelops-ai.com",
    poll_timeout=120.0,
)

print("SentinelOps LangChain Governance Middleware active.")
print(f"Connected to Control Center: {base_url}")
print(f"Monitoring Agent: {callback_handler.agent_name} ({callback_handler.agent_id})")
