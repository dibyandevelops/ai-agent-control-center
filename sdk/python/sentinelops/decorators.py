"""Decorator for wrapping agent functions with SentinelOps governance.

Provides both :func:`govern_action` and :meth:`SentinelOps.guard` to automate
the full governance lifecycle:
evaluate → wait for approval → execute → report outcome.

Supports both synchronous and asynchronous functions.

Example::

    from sentinelops import SentinelOps, govern_action

    sentinel = SentinelOps(api_key="sop_live_...")

    @govern_action(client=sentinel, action="publish_release")
    def deploy_release(tag: str):
        ...

    # Or as an async function:
    @govern_action(client=sentinel, action="database_mutation")
    async def mutate_db(query: str):
        ...
"""

from __future__ import annotations

import asyncio
import functools
import inspect
from typing import Any, Callable, Optional, TypeVar

from .exceptions import ActionBlockedError

T = TypeVar("T")


def _make_guard(client: Any) -> Callable[..., Callable]:
    """Create a guard decorator bound to a SentinelOps client instance."""

    def guard(
        *,
        agent_id: str = "custom-agent",
        agent_name: str = "Autonomous Agent",
        action: Optional[str] = None,
        resource: Optional[str] = None,
        environment: str = "production",
        owner_email: str = "agent@company.com",
        team: str = "Engineering",
        provider: str = "Unknown",
        poll_timeout: float = 300,
        poll_interval: float = 2,
    ) -> Callable[[Callable[..., T]], Callable[..., T]]:
        return govern_action(
            client=client,
            agent_id=agent_id,
            agent_name=agent_name,
            action=action,
            resource=resource,
            environment=environment,
            owner_email=owner_email,
            team=team,
            provider=provider,
            poll_timeout=poll_timeout,
            poll_interval=poll_interval,
        )

    return guard


def govern_action(
    client: Optional[Any] = None,
    *,
    agent_id: str = "custom-agent",
    agent_name: str = "Autonomous Agent",
    action: Optional[str] = None,
    resource: Optional[str] = None,
    environment: str = "production",
    owner_email: str = "agent@company.com",
    team: str = "Engineering",
    provider: str = "Custom",
    poll_timeout: float = 300,
    poll_interval: float = 2,
) -> Callable[[Callable[..., T]], Callable[..., T]]:
    """Decorator that wraps a sync or async function with SentinelOps governance."""

    def decorator(fn: Callable[..., T]) -> Callable[..., T]:
        # Lazy load client if not supplied
        resolved_client = client
        if resolved_client is None:
            from .client import SentinelOps
            resolved_client = SentinelOps()

        actual_action = action or fn.__name__

        if inspect.iscoroutinefunction(fn):
            @functools.wraps(fn)
            async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
                resolved_resource = resource or (str(args[0]) if args else "unknown")

                # Step 1: Evaluate
                decision = resolved_client.evaluate(
                    agent_id=agent_id,
                    agent_name=agent_name,
                    action=actual_action,
                    resource=resolved_resource,
                    environment=environment,
                    owner_email=owner_email,
                    team=team,
                    provider=provider,
                )

                # Step 2: Poll for approval if pending
                if decision.pending:
                    decision = await asyncio.to_thread(
                        resolved_client.poll,
                        decision.request_id,
                        timeout=poll_timeout,
                        interval=poll_interval,
                    )

                # Step 3: Check block status
                if decision.blocked:
                    raise ActionBlockedError(
                        f"Action '{actual_action}' on '{resolved_resource}' was {decision.status}: {decision.reason}",
                        request_id=decision.request_id,
                        reason=decision.reason,
                    )

                # Step 4: Execute async target
                try:
                    result = await fn(*args, **kwargs)
                    summary = "Action completed successfully."
                    if isinstance(result, dict) and "summary" in result:
                        summary = str(result["summary"])

                    resolved_client.report_outcome(
                        decision.request_id,
                        status="succeeded",
                        summary=summary[:1000],
                    )
                    return result
                except Exception as exc:
                    resolved_client.report_outcome(
                        decision.request_id,
                        status="failed",
                        summary=f"Execution failed: {exc}"[:1000],
                        error_code=type(exc).__name__[:120],
                    )
                    raise

            return async_wrapper  # type: ignore[return-value]

        else:
            @functools.wraps(fn)
            def sync_wrapper(*args: Any, **kwargs: Any) -> T:
                resolved_resource = resource or (str(args[0]) if args else "unknown")

                # Step 1: Evaluate
                decision = resolved_client.evaluate(
                    agent_id=agent_id,
                    agent_name=agent_name,
                    action=actual_action,
                    resource=resolved_resource,
                    environment=environment,
                    owner_email=owner_email,
                    team=team,
                    provider=provider,
                )

                # Step 2: Poll for approval if pending
                if decision.pending:
                    decision = resolved_client.poll(
                        decision.request_id,
                        timeout=poll_timeout,
                        interval=poll_interval,
                    )

                # Step 3: Check block status
                if decision.blocked:
                    raise ActionBlockedError(
                        f"Action '{actual_action}' on '{resolved_resource}' was {decision.status}: {decision.reason}",
                        request_id=decision.request_id,
                        reason=decision.reason,
                    )

                # Step 4: Execute function
                try:
                    result = fn(*args, **kwargs)
                    summary = "Action completed successfully."
                    if isinstance(result, dict) and "summary" in result:
                        summary = str(result["summary"])

                    resolved_client.report_outcome(
                        decision.request_id,
                        status="succeeded",
                        summary=summary[:1000],
                    )
                    return result
                except Exception as exc:
                    resolved_client.report_outcome(
                        decision.request_id,
                        status="failed",
                        summary=f"Execution failed: {exc}"[:1000],
                        error_code=type(exc).__name__[:120],
                    )
                    raise

            return sync_wrapper

    return decorator
