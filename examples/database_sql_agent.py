#!/usr/bin/env python3
"""
Real-World Scenario: Autonomous Database & SQL Migration Agent ("DBA-Bot v2")
=============================================================================
In modern engineering teams, AI agents (powered by Claude 3.5 Sonnet, GPT-4o,
or LangChain) are used to analyze performance, write SQL queries, and prepare
database migrations.

The danger: An unconstrained agent executing SQL directly in production can
accidentally lock high-traffic tables or corrupt data.

SentinelOps Solution:
- Safe read-only SELECT queries are auto-approved in <20ms.
- Consequential mutations (ALTER TABLE, UPDATE/DELETE, migrations) are intercepted
  and pop up on the Human Operator Control Center before any SQL touches the DB.
"""

import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE_URL = os.getenv("SENTINELOPS_URL", "http://localhost:3000")
API_KEY = os.getenv("SENTINELOPS_AGENT_API_KEY", "sop_live_uBWumvwD2yrQRT4yGwTmwQY-faxFho8Y")

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json",
}

def request_json(url: str, method: str = "GET", payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_msg = e.read().decode("utf-8")
        raise RuntimeError(f"HTTP {e.code} from {url}: {error_msg}")

def poll_for_human_approval(request_id: str, max_wait_seconds: int = 120) -> dict:
    print(f"\n  ⏸️  [SentinelOps] Consequential SQL action INTERCEPTED!")
    print(f"  👉 Open Dashboard to review & approve: {BASE_URL}/dashboard")
    print(f"  ⏳ Polling approval status for Request ID: {request_id}...")

    start_time = time.time()
    while time.time() - start_time < max_wait_seconds:
        time.sleep(3)
        res = request_json(f"{BASE_URL}/api/v1/actions/{request_id}")
        status = res.get("actionRequest", {}).get("status") or res.get("status")

        if status == "approved":
            operator = res.get("decisionByEmail") or "human_operator"
            print(f"\n  🎉 [SentinelOps] OPERATOR APPROVED! (Reviewed by: {operator})")
            return {"approved": True, "operator": operator}

        if status == "denied":
            reason = res.get("decisionReason") or "Rejected by operator"
            print(f"\n  ❌ [SentinelOps] OPERATOR DENIED ACTION: {reason}")
            return {"approved": False, "reason": reason}

        sys.stdout.write(".")
        sys.stdout.flush()

    raise TimeoutError("Timed out waiting for operator sign-off.")

def report_outcome(request_id: str, status: str, summary: str):
    request_json(
        f"{BASE_URL}/api/v1/actions/{request_id}/outcome",
        method="POST",
        payload={"status": status, "summary": summary},
    )
    print("  🔒 [SentinelOps] Cryptographic SHA-256 Merkle audit proof recorded.\n")

def run_agent():
    print("=" * 80)
    print("🤖 Autonomous Database & SQL Agent (\"DBA-Bot v2\") Online")
    print("Target Database: PostgreSQL Cluster (us-east-1)")
    print("=" * 80 + "\n")

    # -------------------------------------------------------------------------
    # TASK 1: Read-only diagnostic query (Auto-Approved by Policy Engine)
    # -------------------------------------------------------------------------
    print("▶ [Task 1/2] Analyzing slow queries and dead tuples on analytics cluster...")
    select_sql = "SELECT relname, n_dead_tup FROM pg_stat_user_tables WHERE n_dead_tup > 5000;"

    eval_read = request_json(
        f"{BASE_URL}/api/v1/actions/evaluate",
        method="POST",
        payload={
            "idempotencyKey": f"dba-read-{int(time.time())}",
            "agent": {
                "externalId": "dba-agent-01",
                "name": "Autonomous DBA Agent",
                "ownerEmail": "data-infra@sentinelops-ai.com",
                "team": "Data Infrastructure",
                "provider": "Anthropic Claude 3.5 Sonnet",
            },
            "action": "db.query.select",
            "resource": "postgres://analytics-cluster/metrics",
            "environment": "development",
            "context": {
                "query": select_sql,
                "isReadOnly": True,
            },
        },
    )

    read_status = eval_read.get("status", "allowed")
    print(f"  🛡️  Policy Decision: {read_status.upper()} (<20ms latency)")
    print(f"  💾 Executing Read Query: \"{select_sql}\"")
    time.sleep(0.3)
    print("  ✅ Read query executed cleanly without human interruption.\n")

    # -------------------------------------------------------------------------
    # TASK 2: Production Schema Migration (High-Risk -> Intercepted for Approval)
    # -------------------------------------------------------------------------
    print("-" * 80)
    print("▶ [Task 2/2] Planning production migration to add unique idempotency index:")
    migration_sql = "ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(64) NOT NULL UNIQUE;"
    print(f"  Proposed SQL: \"{migration_sql}\"")
    print("  Submitting to SentinelOps Zero-Trust Guardrails...")

    eval_migration = request_json(
        f"{BASE_URL}/api/v1/actions/evaluate",
        method="POST",
        payload={
            "idempotencyKey": f"dba-mig-{int(time.time())}",
            "agent": {
                "externalId": "dba-agent-01",
                "name": "Autonomous DBA Agent",
                "ownerEmail": "data-infra@sentinelops-ai.com",
                "team": "Data Infrastructure",
                "provider": "Anthropic Claude 3.5 Sonnet",
            },
            "action": "db.schema.migration",
            "resource": "postgres://production-cluster/orders",
            "environment": "production",  # Triggers high-risk guardrail
            "context": {
                "sql": migration_sql,
                "table": "orders",
                "affectedRowCount": 2500000,
                "changeTicket": "CHG-DB-8891",
                "lockTimeoutMs": 5000,
                "rollbackPlan": "ALTER TABLE orders DROP COLUMN idempotency_key;",
            },
        },
    )

    req_id = eval_migration.get("requestId")
    mig_status = eval_migration.get("status")

    if mig_status == "pending":
        approval = poll_for_human_approval(req_id)
        if approval["approved"]:
            print(f"  💾 [DB:PRODUCTION] Executing: \"{migration_sql}\"")
            time.sleep(0.5)
            report_outcome(
                req_id,
                status="succeeded",
                summary=f"Migration applied successfully after sign-off by {approval['operator']}.",
            )
            print("🏁 Autonomous Database Agent successfully finished all tasks!")
        else:
            print("🛑 Migration aborted per operator denial.")
            report_outcome(
                req_id,
                status="cancelled",
                summary=f"Migration cancelled: {approval['reason']}",
            )
    elif mig_status in ("allowed", "approved"):
        print(f"  ✅ Auto-approved: executing {migration_sql}")
    else:
        print(f"  🚫 Action BLOCKED: {eval_migration.get('reason')}")

if __name__ == "__main__":
    run_agent()
