"""LangChain callback handler for SentinelOps zero-trust agent governance.

Integrates seamlessly with LangChain tools and agents:

Example::

    from langchain_core.tools import tool
    from sentinelops import SentinelOps
    from sentinelops.langchain import SentinelOpsCallbackHandler

    sentinel = SentinelOps(api_key="sop_live_...")
    handler = SentinelOpsCallbackHandler(
        client=sentinel,
        agent_id="customer-service-agent",
        agent_name="Customer Service AI",
    )

    # Attach handler to your LangChain agent, runner, or tool invocation:
    agent_executor.invoke(
        {"input": "Transfer $500 to account #12345"},
        config={"callbacks": [handler]},
    )
"""

from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from uuid import UUID

from .client import SentinelOps
from .exceptions import ActionBlockedError
from .models import Decision

try:
    from langchain_core.callbacks import BaseCallbackHandler
except ImportError:
    # Graceful fallback if langchain_core is not installed
    class BaseCallbackHandler:  # type: ignore[no-redef]
        """Stub base callback handler if langchain_core is not installed."""
        pass


class SentinelOpsCallbackHandler(BaseCallbackHandler):
    """Callback Handler for LangChain agents and tool executions.

    Intercepts tool calls, verifies them against SentinelOps policy guardrails
    in sub-20ms, pauses for human approval when high risk, and writes tamper-evident
    audit evidence upon completion.
    """

    def __init__(
        self,
        client: Optional[SentinelOps] = None,
        *,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        agent_id: str = "langchain-agent",
        agent_name: str = "LangChain Autonomous Agent",
        environment: str = "production",
        owner_email: str = "ai-ops@sentinelops-ai.com",
        team: str = "AI Platform",
        provider: str = "LangChain",
        poll_timeout: float = 300.0,
        poll_interval: float = 2.0,
    ) -> None:
        if client is not None:
            self.client = client
        else:
            self.client = SentinelOps(api_key=api_key, base_url=base_url)

        self.agent_id = agent_id
        self.agent_name = agent_name
        self.environment = environment
        self.owner_email = owner_email
        self.team = team
        self.provider = provider
        self.poll_timeout = poll_timeout
        self.poll_interval = poll_interval

        # Map run_id -> active request_id for outcome reporting
        self._active_requests: Dict[str, str] = {}

    def on_tool_start(
        self,
        serialized: Dict[str, Any],
        input_str: str,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        inputs: Optional[Dict[str, Any]] = None,
        **kwargs: Any,
    ) -> Any:
        """Run before a tool is executed. Evaluates action against SentinelOps."""
        tool_name = serialized.get("name", "unknown_tool")
        run_key = str(run_id)

        # Parse context parameters from inputs or input string
        context_payload: Dict[str, Any] = {}
        if inputs and isinstance(inputs, dict):
            context_payload = inputs
        elif input_str:
            try:
                parsed = json.loads(input_str)
                if isinstance(parsed, dict):
                    context_payload = parsed
                else:
                    context_payload = {"input": input_str}
            except Exception:
                context_payload = {"input": input_str}

        resource_target = (
            context_payload.get("resource")
            or context_payload.get("target")
            or context_payload.get("url")
            or input_str[:120]
            or "tool_execution"
        )

        # Step 1: Real-time sub-20ms policy evaluation
        decision: Decision = self.client.evaluate(
            agent_id=self.agent_id,
            agent_name=self.agent_name,
            action=tool_name,
            resource=str(resource_target),
            context=context_payload,
            environment=self.environment,
            owner_email=self.owner_email,
            team=self.team,
            provider=self.provider,
        )

        # Step 2: If policy requires human-in-the-loop approval, poll until decided
        if decision.pending:
            decision = self.client.poll(
                decision.request_id,
                timeout=self.poll_timeout,
                interval=self.poll_interval,
            )

        # Step 3: If blocked or denied, immediately abort tool execution
        if decision.blocked:
            raise ActionBlockedError(
                f"SentinelOps Policy Blocked Tool '{tool_name}' on '{resource_target}': {decision.reason}",
                request_id=decision.request_id,
                reason=decision.reason,
            )

        # Store request ID for outcome reporting on completion
        self._active_requests[run_key] = decision.request_id

    def on_tool_end(
        self,
        output: Any,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> Any:
        """Run when tool ends successfully. Reports outcome to SentinelOps ledger."""
        run_key = str(run_id)
        request_id = self._active_requests.pop(run_key, None)
        if not request_id:
            return

        summary = f"Tool output: {output}"
        self.client.report_outcome(
            request_id=request_id,
            status="succeeded",
            summary=summary[:1000],
        )

    def on_tool_error(
        self,
        error: BaseException,
        *,
        run_id: UUID,
        parent_run_id: Optional[UUID] = None,
        **kwargs: Any,
    ) -> Any:
        """Run when tool errors. Records failure evidence to SentinelOps ledger."""
        run_key = str(run_id)
        request_id = self._active_requests.pop(run_key, None)
        if not request_id:
            return

        self.client.report_outcome(
            request_id=request_id,
            status="failed",
            summary=f"Tool execution error: {error}"[:1000],
            error_code=type(error).__name__[:120],
        )
