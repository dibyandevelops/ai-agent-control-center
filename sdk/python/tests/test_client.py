"""Unit tests for the SentinelOps Python SDK."""

import httpx
import pytest
import respx

from sentinelops import (
    SentinelOps,
    Decision,
    AuthenticationError,
    ValidationError,
    NotFoundError,
    ConflictError,
    ApprovalTimeoutError,
    ServerError,
)


BASE_URL = "http://localhost:3000"
API_KEY = "sop_live_test_key_for_unit_tests"


# ── Fixtures ────────────────────────────────────────────────────

@pytest.fixture
def mock_api():
    """Start a respx mock for the SentinelOps API."""
    with respx.mock(base_url=BASE_URL) as mock:
        yield mock


@pytest.fixture
def client():
    """Create a SentinelOps client pointed at the mock."""
    return SentinelOps(api_key=API_KEY, base_url=BASE_URL)


# ── Evaluate ────────────────────────────────────────────────────

def test_evaluate_allowed(mock_api, client):
    """An action that matches an 'allow' policy returns approved=True."""
    mock_api.post("/api/v1/actions/evaluate").mock(
        return_value=httpx.Response(201, json={
            "requestId": "req-001",
            "status": "allowed",
            "reason": "No blocking policy matched.",
            "risk": "low",
            "action": "read_data",
            "resource": "dashboard",
            "replayed": False,
            "execution": {"status": "not_started"},
        })
    )

    decision = client.evaluate(
        agent_id="test-agent",
        agent_name="Test Agent",
        action="read_data",
        resource="dashboard",
    )

    assert isinstance(decision, Decision)
    assert decision.approved is True
    assert decision.pending is False
    assert decision.blocked is False
    assert decision.request_id == "req-001"
    assert decision.status == "allowed"
    assert decision.risk == "low"


def test_evaluate_blocked(mock_api, client):
    """An action that matches a 'block' policy returns blocked=True."""
    mock_api.post("/api/v1/actions/evaluate").mock(
        return_value=httpx.Response(201, json={
            "requestId": "req-002",
            "status": "blocked",
            "reason": "Blocked by: No production deployments on Friday",
            "risk": "high",
            "action": "deploy",
            "resource": "production",
            "replayed": False,
            "execution": {"status": "not_started"},
        })
    )

    decision = client.evaluate(
        agent_id="deploy-bot",
        agent_name="Deploy Bot",
        action="deploy",
        resource="production",
    )

    assert decision.approved is False
    assert decision.blocked is True
    assert decision.status == "blocked"
    assert "Friday" in decision.reason


def test_evaluate_pending(mock_api, client):
    """An action requiring approval returns pending=True."""
    mock_api.post("/api/v1/actions/evaluate").mock(
        return_value=httpx.Response(201, json={
            "requestId": "req-003",
            "status": "pending",
            "reason": "Requires approval: High-risk action",
            "risk": "high",
            "action": "send_email",
            "resource": "customer@example.com",
            "replayed": False,
            "execution": {"status": "not_started"},
        })
    )

    decision = client.evaluate(
        agent_id="sales-bot",
        agent_name="Sales Bot",
        action="send_email",
        resource="customer@example.com",
    )

    assert decision.approved is False
    assert decision.pending is True
    assert decision.blocked is False


def test_evaluate_idempotent_replay(mock_api, client):
    """A replayed evaluation returns replayed=True."""
    mock_api.post("/api/v1/actions/evaluate").mock(
        return_value=httpx.Response(200, json={
            "requestId": "req-001",
            "status": "allowed",
            "reason": "No blocking policy matched.",
            "risk": "low",
            "action": "read_data",
            "resource": "dashboard",
            "replayed": True,
            "execution": {"status": "not_started"},
        })
    )

    decision = client.evaluate(
        agent_id="test-agent",
        agent_name="Test Agent",
        action="read_data",
        resource="dashboard",
        idempotency_key="idem-key-001",
    )

    assert decision.replayed is True


# ── Error handling ──────────────────────────────────────────────

def test_evaluate_auth_error(mock_api, client):
    """A 401 raises AuthenticationError."""
    mock_api.post("/api/v1/actions/evaluate").mock(
        return_value=httpx.Response(401, json={"error": "Invalid agent API key."})
    )

    with pytest.raises(AuthenticationError, match="Invalid agent API key"):
        client.evaluate(
            agent_id="test", agent_name="Test", action="x", resource="y",
        )


def test_evaluate_validation_error(mock_api, client):
    """A 400 raises ValidationError with issues."""
    mock_api.post("/api/v1/actions/evaluate").mock(
        return_value=httpx.Response(400, json={
            "error": "Invalid request.",
            "issues": [{"path": "action", "message": "String must contain at least 2 character(s)"}],
        })
    )

    with pytest.raises(ValidationError) as exc_info:
        client.evaluate(
            agent_id="test", agent_name="Test", action="x", resource="y",
        )
    assert len(exc_info.value.issues) == 1


def test_evaluate_server_error(mock_api, client):
    """A 500 raises ServerError."""
    mock_api.post("/api/v1/actions/evaluate").mock(
        return_value=httpx.Response(500, json={"error": "Internal server error."})
    )

    with pytest.raises(ServerError):
        client.evaluate(
            agent_id="test", agent_name="Test", action="xx", resource="yy",
        )


# ── Poll ────────────────────────────────────────────────────────

def test_poll_resolves_to_approved(mock_api, client):
    """Polling a pending action that gets approved."""
    call_count = 0

    def side_effect(request):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            return httpx.Response(200, json={
                "requestId": "req-003",
                "status": "pending",
                "reason": "Awaiting approval",
                "risk": "high",
                "action": "send_email",
                "resource": "customer@example.com",
                "execution": {"status": "not_started"},
            })
        return httpx.Response(200, json={
            "requestId": "req-003",
            "status": "approved",
            "reason": "Approved by operator@company.com",
            "risk": "high",
            "action": "send_email",
            "resource": "customer@example.com",
            "execution": {"status": "not_started"},
        })

    mock_api.get("/api/v1/actions/req-003").mock(side_effect=side_effect)

    decision = client.poll("req-003", timeout=10, interval=0.01)
    assert decision.approved is True
    assert decision.status == "approved"
    assert call_count == 3


def test_poll_timeout(mock_api, client):
    """Polling that exceeds the timeout raises ApprovalTimeoutError."""
    mock_api.get("/api/v1/actions/req-004").mock(
        return_value=httpx.Response(200, json={
            "requestId": "req-004",
            "status": "pending",
            "reason": "Awaiting approval",
            "risk": "high",
            "action": "deploy",
            "resource": "production",
            "execution": {"status": "not_started"},
        })
    )

    with pytest.raises(ApprovalTimeoutError) as exc_info:
        client.poll("req-004", timeout=0.05, interval=0.01)
    assert exc_info.value.request_id == "req-004"


# ── Report Outcome ──────────────────────────────────────────────

def test_report_outcome_success(mock_api, client):
    """Reporting a successful outcome."""
    mock_api.post("/api/v1/actions/req-001/outcome").mock(
        return_value=httpx.Response(201, json={
            "requestId": "req-001",
            "status": "allowed",
            "execution": {"status": "succeeded"},
        })
    )

    result = client.report_outcome(
        "req-001",
        status="succeeded",
        summary="Email sent successfully",
    )

    assert result["execution"]["status"] == "succeeded"


def test_report_outcome_failure(mock_api, client):
    """Reporting a failed outcome with error code."""
    mock_api.post("/api/v1/actions/req-002/outcome").mock(
        return_value=httpx.Response(201, json={
            "requestId": "req-002",
            "status": "allowed",
            "execution": {"status": "failed", "errorCode": "SMTPError"},
        })
    )

    result = client.report_outcome(
        "req-002",
        status="failed",
        summary="SMTP connection refused",
        error_code="SMTPError",
    )

    assert result["execution"]["status"] == "failed"


def test_report_outcome_not_found(mock_api, client):
    """Reporting outcome for a nonexistent request raises NotFoundError."""
    mock_api.post("/api/v1/actions/req-999/outcome").mock(
        return_value=httpx.Response(404, json={"error": "Request not found."})
    )

    with pytest.raises(NotFoundError):
        client.report_outcome("req-999", status="succeeded", summary="ok")


def test_report_outcome_conflict(mock_api, client):
    """Reporting outcome for an already-completed action raises ConflictError."""
    mock_api.post("/api/v1/actions/req-001/outcome").mock(
        return_value=httpx.Response(409, json={
            "error": "Execution is already succeeded and cannot be changed.",
        })
    )

    with pytest.raises(ConflictError):
        client.report_outcome("req-001", status="succeeded", summary="ok again")


# ── Client lifecycle ────────────────────────────────────────────

def test_client_context_manager():
    """Client can be used as a context manager."""
    with SentinelOps(api_key=API_KEY, base_url=BASE_URL) as client:
        assert client._api_key == API_KEY


def test_client_requires_api_key():
    """Client raises AuthenticationError if no key is provided."""
    import os
    env_backup = os.environ.pop("SENTINELOPS_API_KEY", None)
    try:
        with pytest.raises(AuthenticationError, match="No API key"):
            SentinelOps()
    finally:
        if env_backup:
            os.environ["SENTINELOPS_API_KEY"] = env_backup
