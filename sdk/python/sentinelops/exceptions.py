"""SentinelOps SDK exceptions.

Each exception maps to a specific HTTP error class returned by the
SentinelOps API, making it easy to handle failures precisely.
"""


class SentinelOpsError(Exception):
    """Base exception for all SentinelOps SDK errors."""

    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class AuthenticationError(SentinelOpsError):
    """Raised when the API key is invalid, expired, or revoked (HTTP 401)."""

    def __init__(self, message: str = "Invalid or expired API key."):
        super().__init__(message, status_code=401)


class ValidationError(SentinelOpsError):
    """Raised when the request payload fails validation (HTTP 400)."""

    def __init__(self, message: str, issues: list[dict] | None = None):
        super().__init__(message, status_code=400)
        self.issues = issues or []


class NotFoundError(SentinelOpsError):
    """Raised when the requested resource does not exist (HTTP 404)."""

    def __init__(self, message: str = "Resource not found."):
        super().__init__(message, status_code=404)


class ConflictError(SentinelOpsError):
    """Raised when the action conflicts with the current state (HTTP 409)."""

    def __init__(self, message: str = "Request conflicts with current state."):
        super().__init__(message, status_code=409)


class ApprovalTimeoutError(SentinelOpsError):
    """Raised when polling for an approval decision exceeds the timeout."""

    def __init__(self, request_id: str, timeout: float):
        super().__init__(
            f"Approval for request {request_id} was not resolved within {timeout}s.",
        )
        self.request_id = request_id
        self.timeout = timeout


class ActionBlockedError(SentinelOpsError):
    """Raised when an action is blocked by policy or denied by a human reviewer."""

    def __init__(self, message: str, request_id: str, reason: str):
        super().__init__(message)
        self.request_id = request_id
        self.reason = reason


class ServerError(SentinelOpsError):
    """Raised when the SentinelOps API returns an unexpected server error (HTTP 5xx)."""

    def __init__(self, message: str = "SentinelOps server error."):
        super().__init__(message, status_code=500)
