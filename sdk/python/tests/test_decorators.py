"""Unit tests for SentinelOps govern_action and guard decorators."""

import asyncio
import httpx
import pytest
import respx

from sentinelops import SentinelOps, govern_action
from sentinelops.exceptions import ActionBlockedError

BASE_URL = "http://localhost:3000"
API_KEY = "sop_live_test_key"


@pytest.fixture
def mock_api():
    with respx.mock(base_url=BASE_URL) as mock:
        yield mock


@pytest.fixture
def client():
    return SentinelOps(api_key=API_KEY, base_url=BASE_URL)


def test_govern_action_sync_allowed(mock_api, client):
    """Sync function decorated with @govern_action evaluates and executes."""
    eval_route = mock_api.post("/api/v1/actions/evaluate").mock(
        return_value=httpx.Response(201, json={
            "requestId": "req-gov-01",
            "status": "allowed",
            "reason": "Safe read operation",
            "risk": "low",
            "action": "fetch_user",
            "resource": "user_42",
            "replayed": False,
            "execution": {"status": "not_started"},
        })
    )
    outcome_route = mock_api.post("/api/v1/actions/req-gov-01/outcome").mock(
        return_value=httpx.Response(200, json={
            "requestId": "req-gov-01",
            "execution": {"status": "succeeded", "summary": "Action completed successfully."},
        })
    )

    @govern_action(client=client, action="fetch_user")
    def fetch_user(user_id: str):
        return {"id": user_id, "name": "Alice"}

    result = fetch_user("user_42")
    assert result == {"id": "user_42", "name": "Alice"}
    assert eval_route.called
    assert outcome_route.called


def test_govern_action_sync_blocked(mock_api, client):
    """Sync function blocked by SentinelOps raises ActionBlockedError."""
    mock_api.post("/api/v1/actions/evaluate").mock(
        return_value=httpx.Response(200, json={
            "requestId": "req-gov-block",
            "status": "blocked",
            "reason": "Drop table forbidden by security policy",
            "risk": "high",
            "action": "drop_table",
            "resource": "users",
            "replayed": False,
            "execution": {"status": "not_started"},
        })
    )

    @govern_action(client=client, action="drop_table")
    def dangerous_query(table: str):
        return "dropped"

    with pytest.raises(ActionBlockedError) as exc_info:
        dangerous_query("users")

    assert "Drop table forbidden" in str(exc_info.value)
    assert exc_info.value.request_id == "req-gov-block"


@pytest.mark.anyio
async def test_govern_action_async(mock_api, client):
    """Async coroutine function decorated with @govern_action evaluates and executes."""
    eval_route = mock_api.post("/api/v1/actions/evaluate").mock(
        return_value=httpx.Response(201, json={
            "requestId": "req-async-01",
            "status": "allowed",
            "reason": "Allowed async task",
            "risk": "low",
            "action": "async_task",
            "resource": "data_stream",
            "replayed": False,
            "execution": {"status": "not_started"},
        })
    )
    outcome_route = mock_api.post("/api/v1/actions/req-async-01/outcome").mock(
        return_value=httpx.Response(200, json={
            "requestId": "req-async-01",
            "execution": {"status": "succeeded", "summary": "Stream parsed"},
        })
    )

    @govern_action(client=client, action="async_task")
    async def process_stream(name: str):
        await asyncio.sleep(0.01)
        return {"summary": "Stream parsed", "status": "ok"}

    result = await process_stream("data_stream")
    assert result["status"] == "ok"
    assert eval_route.called
    assert outcome_route.called
