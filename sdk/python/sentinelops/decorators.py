"""Decorator for wrapping agent functions with SentinelOps governance.

The :func:`guard` decorator automates the full governance lifecycle:
evaluate → wait for approval → execute → report outcome.

Example::

    from sentinelops import SentinelOps

    sentinel = SentinelOps(api_key="sop_live_...")

    @sentinel.guard(
        agent_id="sales-bot",
        agent_name="Sales Outreach Agent",
        action="send_email",
    )
    def send_cold_email(to: str, subject: str, body: str):
        email_client.send(to=to, subject=subject, body=body)
        return {"sent": True, "to": to}

    # The decorator handles everything:
    # 1. Calls evaluate() before your function runs
    # 2. If pending, polls until approved (or raises)
    # 3. Runs your function only if approved
    # 4. Calls report_outcome() with the result
    result = send_cold_email("prospect@co.com", "Hello!", "...")
"""

from __future__ import annotations

import functools
from typing import Any, Callable, TypeVar

from .exceptions import ActionBlockedError

T = TypeVar("T")


def _make_guard(client: Any) -> Callable[..., Callable]:
    """Create a guard decorator bound to a SentinelOps client instance.

    This is called internally by ``SentinelOps.guard``.
    """

    def guard(
        *,
        agent_id: str,
        agent_name: str,
        action: str,
        resource: str | None = None,
        environment: str = "production",
        owner_email: str = "agent@company.com",
        team: str = "Engineering",
        provider: str = "Unknown",
        poll_timeout: float = 300,
        poll_interval: float = 2,
    ) -> Callable[[Callable[..., T]], Callable[..., T]]:
        """Decorator that wraps a function with SentinelOps governance.

        Parameters
        ----------
        agent_id, agent_name, action :
            Required identifiers for the evaluation.
        resource : str, optional
            If not provided, defaults to the first positional argument
            of the decorated function (converted to string).
        environment : str
            Defaults to ``"production"``.
        poll_timeout : float
            Max seconds to wait for human approval (default 300).
        poll_interval : float
            Seconds between poll attempts (default 2).

        Raises
        ------
        ActionBlockedError
            If the action is blocked by policy or denied by a reviewer.
        """

        def decorator(fn: Callable[..., T]) -> Callable[..., T]:
            @functools.wraps(fn)
            def wrapper(*args: Any, **kwargs: Any) -> T:
                # Resolve the resource — use the explicit value or the first arg
                resolved_resource = resource or (str(args[0]) if args else "unknown")

                # Step 1: Evaluate
                decision = client.evaluate(
                    agent_id=agent_id,
                    agent_name=agent_name,
                    action=action,
                    resource=resolved_resource,
                    environment=environment,
                    owner_email=owner_email,
                    team=team,
                    provider=provider,
                )

                # Step 2: If pending, poll for approval
                if decision.pending:
                    decision = client.poll(
                        decision.request_id,
                        timeout=poll_timeout,
                        interval=poll_interval,
                    )

                # Step 3: If blocked or denied, raise
                if decision.blocked:
                    raise ActionBlockedError(
                        f"Action '{action}' on '{resolved_resource}' was {decision.status}: {decision.reason}",
                        request_id=decision.request_id,
                        reason=decision.reason,
                    )

                # Step 4: Execute the wrapped function
                try:
                    result = fn(*args, **kwargs)

                    # Step 5: Report success
                    summary = f"Action completed successfully."
                    if isinstance(result, dict) and "summary" in result:
                        summary = str(result["summary"])

                    client.report_outcome(
                        decision.request_id,
                        status="succeeded",
                        summary=summary[:1000],
                    )
                    return result

                except Exception as exc:
                    # Report failure
                    client.report_outcome(
                        decision.request_id,
                        status="failed",
                        summary=f"Execution failed: {exc}"[:1000],
                        error_code=type(exc).__name__[:120],
                    )
                    raise

            return wrapper

        return decorator

    return guard
