import json
import os
import time
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, Callable


class SentinelOpsError(Exception):
    """Base exception for SentinelOps client operations."""
    pass


class SentinelOpsClient:
    """
    Sleek, lightweight Python client wrapper for the SentinelOps API.
    Provides standard evaluation wrappers and decorator guards for AI-agent actions.
    """

    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key or os.environ.get("SENTINELOPS_AGENT_API_KEY")
        self.base_url = (base_url or os.environ.get("SENTINELOPS_BASE_URL", "http://localhost:3000")).rstrip("/")

        if not self.api_key:
            raise SentinelOpsError("SentinelOps API Key must be provided or set in SENTINELOPS_AGENT_API_KEY env.")

    def evaluate(
        self,
        action: str,
        resource: str,
        environment: str = "development",
        context: Optional[Dict[str, Any]] = None,
        idempotency_key: Optional[str] = None,
        agent_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Evaluate an action against the SentinelOps policy engine.
        Returns the decision payload.
        """
        payload = {
            "action": action,
            "resource": resource,
            "environment": environment,
            "context": context or {},
            "idempotencyKey": idempotency_key,
            "agent": agent_metadata or {
                "externalId": "python-agent-client",
                "name": "Python Agent Client",
                "ownerEmail": "platform@company.com",
                "team": "Engineering",
                "provider": "Custom"
            }
        }

        url = f"{self.base_url}/api/v1/actions/evaluate"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )

        try:
            with urllib.request.urlopen(req) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            try:
                err_data = json.loads(e.read().decode("utf-8"))
                err_msg = err_data.get("error", e.reason)
            except Exception:
                err_msg = e.reason
            raise SentinelOpsError(f"API Error ({e.code}): {err_msg}")
        except Exception as e:
            raise SentinelOpsError(f"Failed to communicate with SentinelOps: {str(e)}")

    def wait_for_decision(
        self,
        request_id: str,
        timeout_seconds: int = 60,
        poll_interval: float = 1.0
    ) -> Dict[str, Any]:
        """
        Poll SentinelOps until a pending action request receives a final decision.
        """
        url = f"{self.base_url}/api/v1/actions/{request_id}/details"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
        }

        start_time = time.time()
        while time.time() - start_time < timeout_seconds:
            req = urllib.request.Request(url, headers=headers, method="GET")
            try:
                with urllib.request.urlopen(req) as response:
                    data = json.loads(response.read().decode("utf-8"))
                    # The details endpoint returns evaluation details, decision status etc.
                    status = data.get("payload", {}).get("decision", {}).get("status")
                    if status in ("approved", "denied"):
                        return data.get("payload", {})
            except Exception as e:
                # Log error or continue polling
                pass
            time.sleep(poll_interval)

        raise SentinelOpsError(f"Decision polling timed out after {timeout_seconds} seconds.")

    def guard(self, action: str, get_resource: Callable[..., str], get_context: Optional[Callable[..., dict]] = None):
        """
        Decorator to guard a Python function. Automatically checks policies before executing.
        Raises an exception if the action is denied.
        """
        def decorator(func):
            def wrapper(*args, **kwargs):
                resource = get_resource(*args, **kwargs)
                context = get_context(*args, **kwargs) if get_context else {}
                
                decision = self.evaluate(action=action, resource=resource, context=context)
                status = decision.get("status")
                
                if status == "approved":
                    return func(*args, **kwargs)
                elif status == "pending":
                    print(f"Action '{action}' is pending approval (Request: {decision.get('requestId')}). Waiting...")
                    details = self.wait_for_decision(decision.get("requestId"))
                    if details.get("decision", {}).get("status") == "approved":
                        return func(*args, **kwargs)
                    else:
                        raise SentinelOpsError(f"Action '{action}' was denied by operator.")
                else:
                    raise SentinelOpsError(f"Action '{action}' was denied immediately by SentinelOps Policy Engine.")
            return wrapper
        return decorator


# --- Example Usage ---
if __name__ == "__main__":
    # Mocking credentials for showcase run
    os.environ["SENTINELOPS_AGENT_API_KEY"] = os.environ.get("SENTINELOPS_AGENT_API_KEY", "mock-api-key")
    os.environ["SENTINELOPS_BASE_URL"] = os.environ.get("SENTINELOPS_BASE_URL", "http://localhost:3000")

    try:
        client = SentinelOpsClient()
        
        # 1. Simple Evaluation
        decision = client.evaluate(
            action="deploy.release",
            resource="sentinelops/platform@v1.2.0",
            context={"changeTicket": "PROD-102"}
        )
        print("Evaluation Status:", decision.get("status"))

        # 2. Decorator Guard
        @client.guard(
            action="invoice.payment.prepare",
            get_resource=lambda inv_id, amount: f"invoice/{inv_id}",
            get_context=lambda inv_id, amount: {"amount": amount}
        )
        def process_payment(invoice_id: str, amount: float):
            print(f"Payment processed successfully for {invoice_id} of amount ${amount}.")

        # This will trigger evaluate() automatically before executing process_payment()
        # process_payment("INV-2045", 5000.0)

    except SentinelOpsError as e:
        print(f"SentinelOps Integration Error: {e}")
