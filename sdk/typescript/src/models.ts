export type DecisionStatus = "allowed" | "pending" | "approved" | "denied" | "blocked";
export type ActionRisk = "low" | "medium" | "high";
export type ExecutionEnvironment = "development" | "staging" | "production";

export interface EvaluationInput {
  agentId: string;
  agentName?: string;
  action: string;
  resource: string;
  environment?: ExecutionEnvironment;
  riskHint?: ActionRisk;
  context?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface Decision {
  readonly requestId: string;
  readonly status: DecisionStatus;
  readonly risk: ActionRisk;
  readonly reason: string;
  readonly evaluatedAt: string;
  readonly executionToken?: string;
  readonly expiresAt?: string;

  /** True if the policy allows execution immediately or via granted human approval */
  readonly allowed: boolean;

  /** True if the action is queued waiting for human approval */
  readonly pending: boolean;

  /** True if the action is denied or blocked */
  readonly blocked: boolean;
}

export interface ReportOutcomeInput {
  status: "succeeded" | "failed" | "rolled_back";
  summary?: string;
  externalReference?: string;
  attemptCount?: number;
}

export interface PollOptions {
  /** Maximum time in seconds to wait for human approval (default: 300) */
  timeoutSeconds?: number;
  /** Interval in milliseconds between poll attempts (default: 2000) */
  pollIntervalMs?: number;
}
