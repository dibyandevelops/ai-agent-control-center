#!/usr/bin/env python3
"""SentinelOps Connection Test

Run this script to verify your API key and connection to SentinelOps.
It sends a harmless test action, checks the decision, reports a test
outcome, and confirms the full round-trip works.

Usage:
    # Using environment variable:
    export SENTINELOPS_API_KEY=sop_live_...
    python test_connection.py

    # Or pass the key directly:
    python test_connection.py --api-key sop_live_...

    # For local development:
    python test_connection.py --base-url http://localhost:3000
"""

from __future__ import annotations

import argparse
import sys

from sentinelops import SentinelOps, SentinelOpsError


def main() -> int:
    parser = argparse.ArgumentParser(description="Test your SentinelOps connection.")
    parser.add_argument("--api-key", help="Agent API key (or set SENTINELOPS_API_KEY)")
    parser.add_argument("--base-url", help="Base URL (default: https://trysentinelops.com)")
    args = parser.parse_args()

    kwargs = {}
    if args.api_key:
        kwargs["api_key"] = args.api_key
    if args.base_url:
        kwargs["base_url"] = args.base_url

    print()
    print("  SentinelOps Connection Test")
    print("  " + "=" * 40)
    print()

    # Step 1: Create client
    try:
        sentinel = SentinelOps(**kwargs)
        print("  ✓ Client created")
    except SentinelOpsError as e:
        print(f"  ✗ Failed to create client: {e}")
        return 1

    # Step 2: Send a test evaluation
    try:
        decision = sentinel.evaluate(
            agent_id="sentinelops-sdk-test",
            agent_name="SDK Connection Test",
            action="test.connection",
            resource="sdk-test-resource",
            environment="development",
            owner_email="test@sentinelops.dev",
            team="SDK Tests",
            provider="SentinelOps SDK",
            context={"purpose": "connection_test", "sdk_version": "0.1.0"},
        )
        org = decision.raw.get("organization", "Unknown")
        print(f"  ✓ Connected to SentinelOps ({org})")
        print(f"  ✓ Test action evaluated: {decision.status.upper()} (risk: {decision.risk})")
    except SentinelOpsError as e:
        print(f"  ✗ Evaluation failed: {e}")
        return 1

    # Step 3: Report test outcome (only if the action was approved)
    if decision.approved:
        try:
            sentinel.report_outcome(
                decision.request_id,
                status="succeeded",
                summary="SDK connection test completed successfully.",
            )
            print("  ✓ Execution outcome reported: succeeded")
        except SentinelOpsError as e:
            print(f"  ⚠ Outcome report failed (non-critical): {e}")
    elif decision.pending:
        print("  ⚠ Action is pending human approval — this is expected if you")
        print("    have an 'approval' policy matching the test action.")
        print(f"    Request ID: {decision.request_id}")
        print("    Approve it in the SentinelOps dashboard to complete the test.")
    else:
        print(f"  ⚠ Action was {decision.status}: {decision.reason}")
        print("    This means your policies are working — the test action was evaluated.")

    print()
    print("  " + "-" * 40)
    print("  ✓ Full round-trip complete — your integration is working!")
    print()
    print(f"  Request ID:  {decision.request_id}")
    print(f"  Dashboard:   {sentinel._base_url}/dashboard")
    print()

    sentinel.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
