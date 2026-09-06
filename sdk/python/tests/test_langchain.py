"""Unit tests for SentinelOps LangChain Callback Handler."""

import uuid
import httpx
import pytest
import respx

from sentinelops import SentinelOps
from sentinelops.exceptions import ActionBlockedError
from sentinelops.langchain import SentinelOpsCallbackHandler

BASE_URL = "http://localhost:3000"
API_KEY = "sop_live_test_key"


@pytest.fixture
def mock_api():
    with respx.mock(base_url=BASE_URL) as mock:
        yield mock


@pytest.fixture
def client():
    return SentinelOps(api_key=API_KEY, base_url=BASE_URL)


@pytest.fixture
def handler(client):
    return SentinelOpsCallbackHandler(
        client=client,
        agent_id="agent-langchain-test",
        agent_name="LangChain Test Bot",
    )


def test_callback_handler_allowed_tool(mock_api, handler):
    """Tool execution allowed by SentinelOps policy proceeds cleanly."""
    eval_route = mock_api.post("/api/v1/actions/evaluate").mock(
        return_value=httpx.Response(201, json={
            "requestId": "req-lc-01",
            "status": "allowed",
            "reason": "Safe tool permitted",
            "risk": "low",
            "action": "web_search",
            "resource": "https://docs.sentinelops-ai.com",
            "replayed": False,
            "execution": {"status": "not_started"},
        })
    )
    outcome_route = mock_api.post("/api/v1/actions/req-lc-01/outcome").mock(
        return_value=httpx.Response(200, json={
            "requestId": "req-lc-01",
            "execution": {"status": "succeeded", "summary": "Search results found."},
        })
    )

    run_id = uuid.uuid4()
    handler.on_tool_start(
        serialized={"name": "web_search"},
        input_str='{"url": "https://docs.sentinelops-ai.com"}',
        run_id=run_id,
    )
    assert eval_route.called
    assert handler._active_requests[str(run_id)] == "req-lc-01"

    handler.on_tool_end("Search results found.", run_id=run_id)
    assert outcome_route.called
    assert str(run_id) not in handler._active_requests


def test_callback_handler_blocked_tool(mock_api, handler):
    """Tool execution blocked by SentinelOps policy raises ActionBlockedError."""
    mock_api.post("/api/v1/actions/evaluate").mock(
        return_value=httpx.Response(200, json={
            "requestId": "req-lc-block",
            "status": "blocked",
            "reason": "Exfiltration destination blocked by Zero-Trust policy",
            "risk": "high",
            "action": "export_database",
            "resource": "s3://unapproved-bucket/dump.sql",
            "replayed": False,
            "execution": {"status": "not_started"},
        })
    )

    run_id = uuid.uuid4()
    with pytest.raises(ActionBlockedError) as exc_info:
        handler.on_tool_start(
            serialized={"name": "export_database"},
            input_str='{"resource": "s3://unapproved-bucket/dump.sql"}',
            run_id=run_id,
        )

    assert "Exfiltration destination blocked" in str(exc_info.value)
    assert exc_info.value.request_id == "req-lc-block"


def test_callback_handler_tool_error_recorded(mock_api, handler):
    """Tool failure reports execution failure status to SentinelOps ledger."""
    mock_api.post("/api/v1/actions/evaluate").mock(
        return_value=httpx.Response(201, json={
            "requestId": "req-lc-err",
            "status": "allowed",
            "reason": "Allowed",
            "risk": "low",
            "action": "flaky_tool",
            "resource": "api_endpoint",
            "replayed": False,
            "execution": {"status": "not_started"},
        })
    )
    outcome_route = mock_api.post("/api/v1/actions/req-lc-err/outcome").mock(
        return_value=httpx.Response(200, json={
            "requestId": "req-lc-err",
            "execution": {"status": "failed", "errorCode": "ValueError"},
        })
    )

    run_id = uuid.uuid4()
    handler.on_tool_start(
        serialized={"name": "flaky_tool"},
        input_str='{"target": "api_endpoint"}',
        run_id=run_id,
    )

    handler.on_tool_error(ValueError("Connection reset by peer"), run_id=run_id)
    assert outcome_route.called
