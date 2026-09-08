"""SentinelOps Python SDK — core client.

This module provides the :class:`SentinelOps` client that wraps the three
core API endpoints:

1. **evaluate** — submit an agent action for policy evaluation
2. **poll** — wait for a pending human-approval decision to resolve
3. **report_outcome** — tell SentinelOps how the execution went

Example::

    from sentinelops import SentinelOps

    sentinel = SentinelOps(api_key="sop_live_...")

    decision = sentinel.evaluate(
        agent_id="sales-bot",
        agent_name="Sales Outreach Agent",
        action="send_email",
        resource="prospect@company.com",
    )

    if decision.approved:
        send_email(...)
        sentinel.report_outcome(decision.request_id,
                                status="succeeded",
                                summary="Email sent successfully")
    else:
        print(f"Blocked: {decision.reason}")
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Any

import httpx

from .exceptions import (
    ActionBlockedError,
    AgentQuarantinedError,
    ApprovalTimeoutError,
    AuthenticationError,
    ConflictError,
    NotFoundError,
    ServerError,
    SentinelOpsError,
    ValidationError,
)
from .decorators import _make_guard
from .models import Decision

__all__ = ["SentinelOps"]

_DEFAULT_BASE_URL = "https://sentinelops-ai.com"
_DEFAULT_TIMEOUT = 30.0


class SentinelOps:
    """Client for the SentinelOps governance API.

    Parameters
    ----------
    api_key : str, optional
        Agent API key (starts with ``sop_live_``).  If not provided, the
        ``SENTINELOPS_API_KEY`` environment variable is used.
    base_url : str, optional
        Base URL of the SentinelOps instance.  Defaults to
        ``https://sentinelops-ai.com``.  Override for self-hosted or local
        development (e.g. ``http://localhost:3000``).
    timeout : float, optional
        HTTP request timeout in seconds.  Defaults to 30.
    """

    def __init__(
        self,
        api_key: str | None = None,
        *,
        base_url: str | None = None,
        timeout: float = _DEFAULT_TIMEOUT,
    ):
        resolved_key = api_key or os.environ.get("SENTINELOPS_API_KEY")
        if not resolved_key:
            raise AuthenticationError(
                "No API key provided.  Pass api_key= or set the "
                "SENTINELOPS_API_KEY environment variable."
            )

        self._api_key = resolved_key
        self._base_url = (base_url or os.environ.get("SENTINELOPS_BASE_URL") or _DEFAULT_BASE_URL).rstrip("/")
        self._client = httpx.Client(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
                "User-Agent": "sentinelops-python/0.1.0",
            },
            timeout=timeout,
        )
        self.guard = _make_guard(self)

    # ── public API ──────────────────────────────────────────────

    def evaluate(
        self,
        *,
        agent_id: str,
        agent_name: str,
        action: str,
        resource: str,
        environment: str = "production",
        context: dict[str, Any] | None = None,
        owner_email: str = "agent@company.com",
        team: str = "Engineering",
        provider: str = "Unknown",
        idempotency_key: str | None = None,
        risk_hint: str | None = None,
    ) -> Decision:
        """Submit an agent action for policy evaluation.

        Parameters
        ----------
        agent_id : str
            Unique identifier for the agent (e.g. ``"sales-bot"``).
        agent_name : str
            Human-readable name (e.g. ``"Sales Outreach Agent"``).
        action : str
            The action being performed (e.g. ``"send_email"``).
        resource : str
            The target of the action (e.g. ``"prospect@company.com"``).
        environment : str
            One of ``"development"``, ``"staging"``, ``"production"``.
        context : dict, optional
            Arbitrary key-value metadata for policy evaluation.
        owner_email : str
            Email of the person responsible for this agent.
        team : str
            Team that owns this agent.
        provider : str
            AI provider (e.g. ``"OpenAI"``, ``"Anthropic"``).
        idempotency_key : str, optional
            Unique key to prevent duplicate evaluations.  Auto-generated
            if not provided.
        risk_hint : str, optional
            Optional risk override: ``"low"``, ``"medium"``, or ``"high"``.

        Returns
        -------
        Decision
            The policy evaluation result.  Check ``decision.approved``
            to see if the action is safe to execute.
        """
        payload: dict[str, Any] = {
            "idempotencyKey": idempotency_key or uuid.uuid4().hex,
            "agent": {
                "externalId": agent_id,
                "name": agent_name,
                "ownerEmail": owner_email,
                "team": team,
                "provider": provider,
            },
            "action": action,
            "resource": resource,
            "environment": environment,
            "context": context or {},
        }
        if risk_hint is not None:
            payload["riskHint"] = risk_hint

        data = self._post("/api/v1/actions/evaluate", payload)
        return Decision.from_api_response(data)

    def poll(
        self,
        request_id: str,
        *,
        timeout: float = 300,
        interval: float = 2,
    ) -> Decision:
        """Wait for a pending approval to be resolved.

        Parameters
        ----------
        request_id : str
            The ``request_id`` from a previous :meth:`evaluate` call.
        timeout : float
            Maximum seconds to wait before raising
            :class:`~sentinelops.exceptions.ApprovalTimeoutError`.
        interval : float
            Seconds between polling attempts.

        Returns
        -------
        Decision
            The resolved decision (approved, denied, or blocked).

        Raises
        ------
        ApprovalTimeoutError
            If the approval is not resolved within ``timeout`` seconds.
        """
        deadline = time.monotonic() + timeout

        while time.monotonic() < deadline:
            data = self._get(f"/api/v1/actions/{request_id}")
            decision = Decision.from_api_response(data)

            if not decision.pending:
                return decision

            remaining = deadline - time.monotonic()
            time.sleep(min(interval, max(0, remaining)))

        raise ApprovalTimeoutError(request_id, timeout)

    def report_outcome(
        self,
        request_id: str,
        *,
        status: str,
        summary: str,
        external_reference: str | None = None,
        error_code: str | None = None,
    ) -> dict[str, Any]:
        """Report the execution outcome of an approved action.

        Parameters
        ----------
        request_id : str
            The ``request_id`` from the original evaluation.
        status : str
            One of ``"executing"``, ``"succeeded"``, ``"failed"``,
            ``"cancelled"``.
        summary : str
            Human-readable summary of what happened.
        external_reference : str, optional
            Link or ID in an external system (e.g. a ticket URL).
        error_code : str, optional
            Error code (only valid when ``status="failed"``).

        Returns
        -------
        dict
            The updated action request from the API.
        """
        payload: dict[str, Any] = {
            "status": status,
            "summary": summary,
        }
        if external_reference is not None:
            payload["externalReference"] = external_reference
        if error_code is not None:
            payload["errorCode"] = error_code

        return self._post(f"/api/v1/actions/{request_id}/outcome", payload)

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()

    def __enter__(self) -> SentinelOps:
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    # ── internal helpers ────────────────────────────────────────

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = self._client.post(path, json=payload)
        return self._handle_response(response)

    def _get(self, path: str) -> dict[str, Any]:
        response = self._client.get(path)
        return self._handle_response(response)

    @staticmethod
    def _handle_response(response: httpx.Response) -> dict[str, Any]:
        if response.is_success:
            return response.json()

        try:
            body = response.json()
        except Exception:
            body = {"error": response.text or "Unknown error"}

        error_message = body.get("error", "Unknown error")

        if response.status_code == 400:
            raise ValidationError(error_message, issues=body.get("issues"))
        if response.status_code == 401:
            raise AuthenticationError(error_message)
        if response.status_code == 404:
            raise NotFoundError(error_message)
        if response.status_code == 409:
            raise ConflictError(error_message)
        if response.status_code == 423:
            raise AgentQuarantinedError(error_message, request_id=body.get("requestId"))
        if response.status_code >= 500:
            raise ServerError(error_message)

        raise SentinelOpsError(error_message, status_code=response.status_code)
