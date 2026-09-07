export class SentinelOpsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SentinelOpsError";
  }
}

export class AuthenticationError extends SentinelOpsError {
  constructor(message = "Invalid or expired SentinelOps API key.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class ValidationError extends SentinelOpsError {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ActionBlockedError extends SentinelOpsError {
  readonly requestId: string;
  readonly reason: string;
  readonly risk: string;

  constructor(requestId: string, reason: string, risk: string) {
    super(`Action blocked by SentinelOps policy: ${reason} (Risk: ${risk}, Request ID: ${requestId})`);
    this.name = "ActionBlockedError";
    this.requestId = requestId;
    this.reason = reason;
    this.risk = risk;
  }
}

export class ApprovalTimeoutError extends SentinelOpsError {
  readonly requestId: string;

  constructor(requestId: string, timeoutSeconds: number) {
    super(`Human-in-the-loop approval timed out after ${timeoutSeconds}s for request ${requestId}.`);
    this.name = "ApprovalTimeoutError";
    this.requestId = requestId;
  }
}
