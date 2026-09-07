import { randomUUID } from "node:crypto";
import {
  ActionBlockedError,
  ApprovalTimeoutError,
  AuthenticationError,
  SentinelOpsError,
  ValidationError,
} from "./errors";
import type {
  Decision,
  DecisionStatus,
  EvaluationInput,
  PollOptions,
  ReportOutcomeInput,
} from "./models";

const DEFAULT_BASE_URL = "https://sentinelops-ai.com";
const DEFAULT_TIMEOUT_MS = 30_000;

export interface ClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class SentinelOps {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: ClientOptions = {}) {
    const key = options.apiKey || (typeof process !== "undefined" ? process.env.SENTINELOPS_API_KEY : undefined);
    if (!key) {
      throw new AuthenticationError("SentinelOps API key is required. Pass apiKey or set SENTINELOPS_API_KEY.");
    }
    this.apiKey = key.trim();
    this.baseUrl = (options.baseUrl || (typeof process !== "undefined" ? process.env.SENTINELOPS_BASE_URL : undefined) || DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${this.apiKey}`);
    headers.set("content-type", "application/json");
    headers.set("user-agent", "@sentinelops/sdk-js/0.2.0");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        headers,
        signal: controller.signal,
      });

      if (response.status === 401 || response.status === 403) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new AuthenticationError(payload.error || "Authentication failed.");
      }

      if (response.status === 400 || response.status === 422) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new ValidationError(payload.error || "Request validation failed.");
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new SentinelOpsError(payload.error || `HTTP ${response.status} from SentinelOps control plane.`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof SentinelOpsError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new SentinelOpsError(`Request to ${url} timed out after ${this.timeoutMs}ms.`);
      }
      throw new SentinelOpsError(error instanceof Error ? error.message : String(error));
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Evaluates an agent action against organization-scoped policies in sub-20ms.
   */
  async evaluate(input: EvaluationInput): Promise<Decision> {
    const payload = {
      agentId: input.agentId,
      agentName: input.agentName,
      action: input.action,
      resource: input.resource,
      environment: input.environment ?? "production",
      riskHint: input.riskHint ?? "low",
      context: input.context ?? {},
      idempotencyKey: input.idempotencyKey ?? randomUUID(),
    };

    const raw = await this.request<{
      requestId: string;
      status: DecisionStatus;
      risk: "low" | "medium" | "high";
      reason: string;
      evaluatedAt: string;
      executionToken?: string;
      expiresAt?: string;
    }>("/api/v1/actions/evaluate", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return {
      requestId: raw.requestId,
      status: raw.status,
      risk: raw.risk,
      reason: raw.reason,
      evaluatedAt: raw.evaluatedAt,
      executionToken: raw.executionToken,
      expiresAt: raw.expiresAt,
      allowed: raw.status === "allowed" || raw.status === "approved",
      pending: raw.status === "pending",
      blocked: raw.status === "denied" || raw.status === "blocked",
    };
  }

  /**
   * Polls an action request until human-in-the-loop (HITL) approval resolves.
   */
  async pollApproval(requestId: string, options: PollOptions = {}): Promise<Decision> {
    const timeoutSeconds = options.timeoutSeconds ?? 300;
    const intervalMs = options.pollIntervalMs ?? 2000;
    const deadline = Date.now() + timeoutSeconds * 1000;

    while (Date.now() < deadline) {
      const raw = await this.request<{
        id: string;
        decision_status: DecisionStatus;
        risk: "low" | "medium" | "high";
        decision_reason?: string;
        decided_at?: string;
        requested_at: string;
      }>(`/api/v1/actions/${requestId}`, {
        method: "GET",
      });

      const status = raw.decision_status;
      if (status !== "pending") {
        return {
          requestId: raw.id,
          status,
          risk: raw.risk,
          reason: raw.decision_reason || `Status resolved to ${status}`,
          evaluatedAt: raw.decided_at || raw.requested_at,
          allowed: status === "allowed" || status === "approved",
          pending: false,
          blocked: status === "denied" || status === "blocked",
        };
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new ApprovalTimeoutError(requestId, timeoutSeconds);
  }

  /**
   * Reports execution outcome to seal the cryptographic audit trail.
   */
  async reportOutcome(requestId: string, input: ReportOutcomeInput): Promise<void> {
    await this.request<{ acknowledged: boolean }>(`/api/v1/actions/${requestId}/outcome`, {
      method: "POST",
      body: JSON.stringify({
        status: input.status,
        summary: input.summary || `Execution reported ${input.status}`,
        externalReference: input.externalReference,
        attemptCount: input.attemptCount ?? 1,
      }),
    });
  }

  /**
   * High-level wrapper: evaluates policy, awaits HITL approval if pending,
   * runs executeFn upon authorization, and reports outcome automatically.
   */
  async executeWithGovernance<T>(
    input: EvaluationInput,
    executeFn: (decision: Decision) => Promise<T>,
    options: PollOptions = {},
  ): Promise<T> {
    let decision = await this.evaluate(input);

    if (decision.pending) {
      decision = await this.pollApproval(decision.requestId, options);
    }

    if (!decision.allowed) {
      throw new ActionBlockedError(decision.requestId, decision.reason, decision.risk);
    }

    try {
      const result = await executeFn(decision);
      await this.reportOutcome(decision.requestId, {
        status: "succeeded",
        summary: "Execution completed successfully under policy authorization.",
      }).catch(() => {});
      return result;
    } catch (error) {
      await this.reportOutcome(decision.requestId, {
        status: "failed",
        summary: error instanceof Error ? error.message : "Execution failed.",
      }).catch(() => {});
      throw error;
    }
  }
}
