import type { SentinelOps } from "./client";
import { ActionBlockedError } from "./errors";
import type { ActionRisk, ExecutionEnvironment } from "./models";

export interface LangChainCallbackOptions {
  client: SentinelOps;
  agentId: string;
  agentName?: string;
  environment?: ExecutionEnvironment;
  riskHint?: ActionRisk;
  waitForApproval?: boolean;
  approvalTimeoutSeconds?: number;
}

/**
 * LangChain.js CallbackHandler for SentinelOps zero-trust governance.
 * Evaluates tool calls against policy rules in sub-20ms, halts high-risk
 * executions for human approval, and streams cryptographic audit evidence.
 *
 * @example
 * ```ts
 * import { SentinelOpsCallbackHandler } from "@sentinelops/sdk/langchain";
 * import { initializeAgentExecutorWithOptions } from "langchain/agents";
 *
 * const handler = new SentinelOpsCallbackHandler({
 *   client: sentinelops,
 *   agentId: "support-agent",
 * });
 *
 * const executor = await initializeAgentExecutorWithOptions(tools, model, {
 *   callbacks: [handler],
 * });
 * ```
 */
export class SentinelOpsCallbackHandler {
  name = "SentinelOpsCallbackHandler";
  private readonly client: SentinelOps;
  private readonly agentId: string;
  private readonly agentName?: string;
  private readonly environment: ExecutionEnvironment;
  private readonly riskHint: ActionRisk;
  private readonly waitForApproval: boolean;
  private readonly approvalTimeoutSeconds: number;
  private readonly activeRequests = new Map<string, string>();

  constructor(options: LangChainCallbackOptions) {
    this.client = options.client;
    this.agentId = options.agentId;
    this.agentName = options.agentName;
    this.environment = options.environment ?? "production";
    this.riskHint = options.riskHint ?? "low";
    this.waitForApproval = options.waitForApproval ?? true;
    this.approvalTimeoutSeconds = options.approvalTimeoutSeconds ?? 300;
  }

  async handleToolStart(
    tool: { name?: string; description?: string },
    input: string | Record<string, unknown>,
    runId: string,
  ): Promise<void> {
    const action = tool?.name || "tool_execution";
    const context: Record<string, unknown> =
      typeof input === "string" ? { input } : { ...input };

    const resource = `tool://${action}`;

    let decision = await this.client.evaluate({
      agentId: this.agentId,
      agentName: this.agentName,
      action,
      resource,
      environment: this.environment,
      riskHint: this.riskHint,
      context,
    });

    this.activeRequests.set(runId, decision.requestId);

    if (decision.pending && this.waitForApproval) {
      decision = await this.client.pollApproval(decision.requestId, {
        timeoutSeconds: this.approvalTimeoutSeconds,
      });
    }

    if (!decision.allowed) {
      throw new ActionBlockedError(decision.requestId, decision.reason, decision.risk);
    }
  }

  async handleToolEnd(output: unknown, runId: string): Promise<void> {
    const requestId = this.activeRequests.get(runId);
    if (!requestId) return;
    this.activeRequests.delete(runId);

    const summary =
      typeof output === "string"
        ? output.slice(0, 500)
        : JSON.stringify(output).slice(0, 500);

    await this.client
      .reportOutcome(requestId, {
        status: "succeeded",
        summary: `Tool output: ${summary}`,
      })
      .catch(() => {});
  }

  async handleToolError(error: Error, runId: string): Promise<void> {
    const requestId = this.activeRequests.get(runId);
    if (!requestId) return;
    this.activeRequests.delete(runId);

    await this.client
      .reportOutcome(requestId, {
        status: "failed",
        summary: error.message,
      })
      .catch(() => {});
  }
}
