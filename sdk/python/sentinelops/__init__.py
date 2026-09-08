"""SentinelOps — Human-in-the-loop governance for AI agents.

Quick start::

    from sentinelops import SentinelOps, govern_action

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

LangChain integration::

    from sentinelops.langchain import SentinelOpsCallbackHandler

    handler = SentinelOpsCallbackHandler(client=sentinel)
"""

__version__ = "0.2.0"

from .client import SentinelOps
from .decorators import govern_action
from .exceptions import (
    ActionBlockedError,
    AgentQuarantinedError,
    ApprovalTimeoutError,
    AuthenticationError,
    ConflictError,
    NotFoundError,
    SentinelOpsError,
    ServerError,
    ValidationError,
)
from .langchain import SentinelOpsCallbackHandler
from .models import Decision, Execution

__all__ = [
    "SentinelOps",
    "govern_action",
    "SentinelOpsCallbackHandler",
    "Decision",
    "Execution",
    "SentinelOpsError",
    "AuthenticationError",
    "ValidationError",
    "NotFoundError",
    "ConflictError",
    "ApprovalTimeoutError",
    "ActionBlockedError",
    "AgentQuarantinedError",
    "ServerError",
]
