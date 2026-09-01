"""SentinelOps — Human-in-the-loop governance for AI agents.

Quick start::

    from sentinelops import SentinelOps

    sentinel = SentinelOps(api_key="sop_live_...")

    decision = sentinel.evaluate(
        agent_id="my-agent",
        agent_name="My AI Agent",
        action="send_email",
        resource="user@example.com",
    )

    if decision.approved:
        # safe to proceed
        ...
"""

__version__ = "0.1.0"

from .client import SentinelOps
from .exceptions import (
    ActionBlockedError,
    ApprovalTimeoutError,
    AuthenticationError,
    ConflictError,
    NotFoundError,
    SentinelOpsError,
    ServerError,
    ValidationError,
)
from .models import Decision, Execution

__all__ = [
    "SentinelOps",
    "Decision",
    "Execution",
    "SentinelOpsError",
    "AuthenticationError",
    "ValidationError",
    "NotFoundError",
    "ConflictError",
    "ApprovalTimeoutError",
    "ActionBlockedError",
    "ServerError",
]
