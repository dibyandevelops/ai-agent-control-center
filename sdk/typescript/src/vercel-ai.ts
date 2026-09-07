import type { SentinelOps } from "./client";
import type { ActionRisk, ExecutionEnvironment } from "./models";

export interface GovernedToolOptions<TArgs = Record<string, unknown>> {
  client: SentinelOps;
  agentId: string;
  agentName?: string;
  action?: string;
  environment?: ExecutionEnvironment;
  riskHint?: ActionRisk;
  resourceExtractor?: (args: TArgs) => string;
  contextExtractor?: (args: TArgs) => Record<string, unknown>;
}

export interface VercelAiTool<TArgs = Record<string, unknown>, TResult = unknown> {
  description?: string;
  parameters?: unknown;
  execute?: (args: TArgs, options?: unknown) => Promise<TResult>;
  [key: string]: unknown;
}

/**
 * Wraps a Vercel AI SDK tool with SentinelOps zero-trust governance.
 * Evaluates policy in sub-20ms before execution, pauses for human approval if high-risk,
 * and records tamper-evident cryptographic audit logs upon execution completion.
 *
 * @example
 * ```ts
 * import { wrapGovernedTool } from "@sentinelops/sdk/vercel-ai";
 * import { tool } from "ai";
 *
 * const transferFunds = wrapGovernedTool(
 *   tool({
 *     description: "Transfer money to a vendor",
 *     parameters: z.object({ amount: z.number(), vendorId: z.string() }),
 *     execute: async ({ amount, vendorId }) => bankApi.transfer(vendorId, amount),
 *   }),
 *   {
 *     client: sentinelops,
 *     agentId: "finance-agent",
 *     action: "transfer_funds",
 *     resourceExtractor: (args) => `vendor://${args.vendorId}`,
 *   }
 * );
 * ```
 */
export function wrapGovernedTool<TArgs extends Record<string, unknown>, TResult>(
  targetTool: VercelAiTool<TArgs, TResult>,
  options: GovernedToolOptions<TArgs>,
): VercelAiTool<TArgs, TResult> {
  const originalExecute = targetTool.execute;
  if (typeof originalExecute !== "function") {
    return targetTool;
  }

  const governedExecute = async (args: TArgs, execOptions?: unknown): Promise<TResult> => {
    const resource = options.resourceExtractor
      ? options.resourceExtractor(args)
      : `tool://${options.action || "unspecified"}`;

    const context = options.contextExtractor ? options.contextExtractor(args) : args;

    return options.client.executeWithGovernance(
      {
        agentId: options.agentId,
        agentName: options.agentName,
        action: options.action || "tool_execution",
        resource,
        environment: options.environment ?? "production",
        riskHint: options.riskHint ?? "low",
        context: (context as Record<string, unknown>) ?? {},
      },
      async () => originalExecute(args, execOptions),
    );
  };

  return {
    ...targetTool,
    execute: governedExecute,
  };
}
