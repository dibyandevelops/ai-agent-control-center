#!/usr/bin/env python3
"""SentinelOps Demo Agent — Sales Outreach Bot

A realistic demo agent that simulates an AI sales assistant
performing governed actions through SentinelOps. Every action
the agent takes — qualifying leads, drafting emails, booking
meetings — passes through SentinelOps for policy evaluation
before execution.

This is both a demo and a proof that SentinelOps works in
production. Run it against your local dev server or the live
platform.

Usage:
    export SENTINELOPS_API_KEY=sop_live_...
    python demo_sales_agent.py

    # Or against local dev:
    python demo_sales_agent.py --base-url http://localhost:3000
"""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import datetime

# Add parent paths so we can import sentinelops from the SDK directory
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parents[1]))

from sentinelops import SentinelOps, SentinelOpsError, ActionBlockedError


# ── Simulated CRM Data ─────────────────────────────────────────

PROSPECTS = [
    {
        "name": "Sarah Chen",
        "email": "sarah.chen@techcorp.io",
        "company": "TechCorp",
        "title": "VP of Engineering",
        "score": 85,
        "industry": "FinTech",
    },
    {
        "name": "James Rodriguez",
        "email": "j.rodriguez@healthai.com",
        "company": "HealthAI",
        "title": "CTO",
        "score": 72,
        "industry": "HealthTech",
    },
    {
        "name": "Priya Sharma",
        "email": "priya@cloudnative.dev",
        "company": "CloudNative",
        "title": "Head of Platform",
        "score": 91,
        "industry": "DevTools",
    },
    {
        "name": "Marcus Weber",
        "email": "m.weber@bankflow.eu",
        "company": "BankFlow",
        "title": "CISO",
        "score": 68,
        "industry": "Banking",
    },
    {
        "name": "Aisha Okafor",
        "email": "aisha@govtech.ng",
        "company": "GovTech Solutions",
        "title": "Director of AI",
        "score": 88,
        "industry": "Government",
    },
]


# ── Simulated Agent Actions ─────────────────────────────────────

def simulate_qualify_lead(prospect: dict) -> dict:
    """Simulate AI lead qualification."""
    time.sleep(0.3)  # simulate processing
    qualified = prospect["score"] >= 70
    return {
        "qualified": qualified,
        "score": prospect["score"],
        "reason": f"Score {prospect['score']}/100 — {'meets' if qualified else 'below'} threshold",
        "summary": f"Lead {prospect['name']} at {prospect['company']} qualified with score {prospect['score']}/100",
    }


def simulate_draft_email(prospect: dict) -> dict:
    """Simulate AI email drafting."""
    time.sleep(0.2)
    subject = f"AI Governance for {prospect['company']}"
    body = (
        f"Hi {prospect['name'].split()[0]},\n\n"
        f"I noticed {prospect['company']} is deploying AI agents in {prospect['industry']}. "
        f"We built SentinelOps specifically for teams like yours — it's a governance layer "
        f"that sits between your AI agents and the actions they take.\n\n"
        f"Would you have 15 minutes this week for a quick demo?\n\n"
        f"Best,\nSales Agent"
    )
    return {
        "to": prospect["email"],
        "subject": subject,
        "body": body,
        "summary": f"Drafted outreach email to {prospect['name']} ({prospect['email']})",
    }


def simulate_book_meeting(prospect: dict) -> dict:
    """Simulate booking a meeting."""
    time.sleep(0.2)
    return {
        "calendar_link": f"https://cal.com/sentinelops/demo?email={prospect['email']}",
        "proposed_time": "Tuesday 2:00 PM EST",
        "summary": f"Meeting invite sent to {prospect['name']} for Tuesday 2:00 PM EST",
    }


def simulate_update_crm(prospect: dict, action_taken: str) -> dict:
    """Simulate CRM update."""
    time.sleep(0.1)
    return {
        "crm_id": f"CRM-{random.randint(10000, 99999)}",
        "status": "updated",
        "summary": f"CRM updated for {prospect['name']}: {action_taken}",
    }


# ── Main Agent Loop ─────────────────────────────────────────────

def run_agent(sentinel: SentinelOps):
    """Run the demo sales agent through a realistic outreach workflow."""

    print()
    print("  ┌─────────────────────────────────────────────────┐")
    print("  │  SentinelOps Demo — AI Sales Agent              │")
    print("  │  Every action is governed by SentinelOps        │")
    print("  └─────────────────────────────────────────────────┘")
    print()

    for i, prospect in enumerate(PROSPECTS, 1):
        print(f"  ── Prospect {i}/{len(PROSPECTS)}: {prospect['name']} ({prospect['company']}) ──")
        print()

        # Action 1: Qualify the lead
        print(f"    🔍 Qualifying lead...")
        try:
            decision = sentinel.evaluate(
                agent_id="demo-sales-agent",
                agent_name="Demo Sales Outreach Agent",
                action="qualify_lead",
                resource=prospect["email"],
                environment="development",
                owner_email="demo@sentinelops.dev",
                team="Sales Automation",
                provider="OpenAI GPT-4",
                context={
                    "prospect_name": prospect["name"],
                    "company": prospect["company"],
                    "industry": prospect["industry"],
                    "lead_score": prospect["score"],
                },
            )

            if decision.approved:
                result = simulate_qualify_lead(prospect)
                sentinel.report_outcome(
                    decision.request_id,
                    status="succeeded",
                    summary=result["summary"],
                )
                print(f"    ✓ {result['reason']} (SentinelOps: {decision.status})")

                if not result["qualified"]:
                    print(f"    ⏭ Skipping — lead below threshold")
                    print()
                    continue
            elif decision.pending:
                print(f"    ⏳ Awaiting human approval (request: {decision.request_id})")
                print()
                continue
            else:
                print(f"    ✗ Blocked: {decision.reason}")
                print()
                continue

        except SentinelOpsError as e:
            print(f"    ✗ Error: {e}")
            print()
            continue

        # Action 2: Draft outreach email
        print(f"    ✉️  Drafting outreach email...")
        try:
            decision = sentinel.evaluate(
                agent_id="demo-sales-agent",
                agent_name="Demo Sales Outreach Agent",
                action="send_email",
                resource=prospect["email"],
                environment="development",
                owner_email="demo@sentinelops.dev",
                team="Sales Automation",
                provider="OpenAI GPT-4",
                context={
                    "prospect_name": prospect["name"],
                    "company": prospect["company"],
                    "email_type": "cold_outreach",
                    "industry": prospect["industry"],
                },
            )

            if decision.approved:
                result = simulate_draft_email(prospect)
                sentinel.report_outcome(
                    decision.request_id,
                    status="succeeded",
                    summary=result["summary"],
                )
                print(f"    ✓ Email drafted to {prospect['email']} (SentinelOps: {decision.status})")
            elif decision.pending:
                print(f"    ⏳ Email pending approval (request: {decision.request_id})")
                print(f"       → Approve in dashboard to send")
            else:
                print(f"    ✗ Email blocked: {decision.reason}")

        except SentinelOpsError as e:
            print(f"    ✗ Error: {e}")

        # Action 3: Update CRM
        print(f"    📋 Updating CRM...")
        try:
            decision = sentinel.evaluate(
                agent_id="demo-sales-agent",
                agent_name="Demo Sales Outreach Agent",
                action="update_crm",
                resource=f"crm://{prospect['company'].lower().replace(' ', '-')}",
                environment="development",
                owner_email="demo@sentinelops.dev",
                team="Sales Automation",
                provider="OpenAI GPT-4",
                context={
                    "prospect_name": prospect["name"],
                    "update_type": "outreach_logged",
                },
            )

            if decision.approved:
                result = simulate_update_crm(prospect, "outreach_sent")
                sentinel.report_outcome(
                    decision.request_id,
                    status="succeeded",
                    summary=result["summary"],
                )
                print(f"    ✓ CRM updated: {result['crm_id']} (SentinelOps: {decision.status})")
            else:
                print(f"    ⚠ CRM update {decision.status}: {decision.reason}")

        except SentinelOpsError as e:
            print(f"    ✗ Error: {e}")

        print()

    # Summary
    print("  ┌─────────────────────────────────────────────────┐")
    print("  │  Agent run complete                             │")
    print("  │                                                 │")
    print("  │  → Open the SentinelOps dashboard to see:      │")
    print("  │    • All agent actions in the Audit Log         │")
    print("  │    • The agent registered in the Agents tab     │")
    print("  │    • Any pending approvals in the queue         │")
    print("  └─────────────────────────────────────────────────┘")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the SentinelOps demo sales agent.")
    parser.add_argument("--api-key", help="Agent API key (or set SENTINELOPS_API_KEY)")
    parser.add_argument("--base-url", default="http://localhost:3000", help="SentinelOps URL (default: localhost:3000)")
    args = parser.parse_args()

    kwargs = {"base_url": args.base_url}
    if args.api_key:
        kwargs["api_key"] = args.api_key

    try:
        sentinel = SentinelOps(**kwargs)
    except SentinelOpsError as e:
        print(f"\n  ✗ Failed to create client: {e}\n")
        return 1

    try:
        run_agent(sentinel)
    finally:
        sentinel.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
