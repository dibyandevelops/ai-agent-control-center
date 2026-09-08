"""Data models returned by the SentinelOps SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Execution:
    """Execution state of an action after it was approved."""

    status: str
    """One of: not_started, executing, succeeded, failed, cancelled."""

    started_at: str | None = None
    completed_at: str | None = None
    external_reference: str | None = None
    summary: str | None = None
    error_code: str | None = None


@dataclass(frozen=True)
class Decision:
    """The result of evaluating an agent action against SentinelOps policies.

    This is the primary return type from :meth:`SentinelOps.evaluate` and
    :meth:`SentinelOps.poll`.  The most important field is :attr:`approved`
    which tells you whether the action is safe to execute.
    """

    request_id: str
    """Unique identifier for this action request. Use this to poll or report outcomes."""

    status: str
    """One of: allowed, pending, approved, denied, blocked."""

    reason: str
    """Human-readable explanation of why the decision was made."""

    risk: str
    """Risk level assigned by the policy engine: low, medium, or high."""

    action: str
    """The action that was evaluated (e.g. 'send_email')."""

    resource: str
    """The resource the action targets (e.g. 'customer@company.com')."""

    replayed: bool = False
    """True if this was an idempotent replay of a previous evaluation."""

    sha256_seal: str | None = None
    """Cryptographic SHA-256 seal anchoring this action decision in the audit chain."""

    execution: Execution = field(default_factory=lambda: Execution(status="not_started"))
    """Current execution state (populated after report_outcome)."""

    raw: dict[str, Any] = field(default_factory=dict, repr=False)
    """The full raw API response for advanced use cases."""

    @property
    def approved(self) -> bool:
        """Whether the action is approved for execution.

        Returns True if the status is 'allowed' (auto-approved by policy)
        or 'approved' (approved by a human reviewer).
        """
        return self.status in ("allowed", "approved")

    @property
    def pending(self) -> bool:
        """Whether the action is waiting for human approval."""
        return self.status == "pending"

    @property
    def blocked(self) -> bool:
        """Whether the action was blocked by policy or denied by a reviewer."""
        return self.status in ("blocked", "denied", "quarantined")

    @property
    def quarantined(self) -> bool:
        """Whether the agent is currently under emergency quarantine."""
        return self.status == "quarantined" or "quarantine" in self.reason.lower()

    @property
    def undo_window_seconds(self) -> int:
        """Remaining seconds in the interactive undo grace period (0 if sealed)."""
        return int(self.raw.get("undoWindowSeconds", 0))

    @classmethod
    def from_api_response(cls, data: dict[str, Any]) -> Decision:
        """Construct a Decision from the raw API JSON response."""
        exec_data = data.get("execution", {})
        execution = Execution(
            status=exec_data.get("status", "not_started"),
            started_at=exec_data.get("startedAt"),
            completed_at=exec_data.get("completedAt"),
            external_reference=exec_data.get("externalReference"),
            summary=exec_data.get("summary"),
            error_code=exec_data.get("errorCode"),
        )
        return cls(
            request_id=data["requestId"],
            status=data["status"],
            reason=data.get("reason", ""),
            risk=data.get("risk", "low"),
            action=data.get("action", ""),
            resource=data.get("resource", ""),
            replayed=data.get("replayed", False),
            sha256_seal=data.get("sha256Seal") or data.get("auditSeal"),
            execution=execution,
            raw=data,
        )
