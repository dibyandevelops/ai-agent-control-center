import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  ActionBlockedError,
  ApprovalTimeoutError,
  AuthenticationError,
  SentinelOps,
  SentinelOpsCallbackHandler,
  wrapGovernedTool,
} from "../src/index";

describe("SentinelOps TypeScript SDK", () => {
  const apiKey = "sop_live_test_1234567890abcdef";
  const baseUrl = "https://mock.sentinelops.test";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws AuthenticationError if API key is missing", () => {
    const originalKey = process.env.SENTINELOPS_API_KEY;
    delete process.env.SENTINELOPS_API_KEY;
    expect(() => new SentinelOps({ apiKey: "" })).toThrow(AuthenticationError);
    if (originalKey) process.env.SENTINELOPS_API_KEY = originalKey;
  });

  it("evaluates an action payload and returns formatted Decision", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        requestId: "req-123",
        status: "allowed",
        risk: "low",
        reason: "Matched standard read policy.",
        evaluatedAt: "2026-09-07T00:00:00Z",
        executionToken: "token-xyz",
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new SentinelOps({ apiKey, baseUrl });
    const decision = await client.evaluate({
      agentId: "agent-007",
      action: "read_database",
      resource: "customers",
    });

    expect(decision.requestId).toBe("req-123");
    expect(decision.status).toBe("allowed");
    expect(decision.allowed).toBe(true);
    expect(decision.pending).toBe(false);
    expect(decision.blocked).toBe(false);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://mock.sentinelops.test/api/v1/actions/evaluate",
      expect.objectContaining({
        method: "POST",
        headers: expect.any(Headers),
      }),
    );
  });

  it("polls until human approval resolves", async () => {
    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => {
          if (callCount === 1) {
            return {
              id: "req-poll",
              decision_status: "pending",
              risk: "high",
              requested_at: "2026-09-07T00:00:00Z",
            };
          }
          return {
            id: "req-poll",
            decision_status: "approved",
            risk: "high",
            decision_reason: "Approved by Lead Administrator in Slack",
            decided_at: "2026-09-07T00:00:05Z",
            requested_at: "2026-09-07T00:00:00Z",
          };
        },
      };
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new SentinelOps({ apiKey, baseUrl });
    const resolved = await client.pollApproval("req-poll", {
      pollIntervalMs: 10,
      timeoutSeconds: 2,
    });

    expect(resolved.status).toBe("approved");
    expect(resolved.allowed).toBe(true);
    expect(resolved.reason).toContain("Approved by Lead Administrator");
    expect(callCount).toBe(2);
  });

  it("reports execution outcome to outcome endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ acknowledged: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new SentinelOps({ apiKey, baseUrl });
    await client.reportOutcome("req-out", {
      status: "succeeded",
      summary: "Customer records updated.",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://mock.sentinelops.test/api/v1/actions/req-out/outcome",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          status: "succeeded",
          summary: "Customer records updated.",
          attemptCount: 1,
        }),
      }),
    );
  });

  it("executeWithGovernance runs executeFn and reports outcome when authorized", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/evaluate")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            requestId: "req-exec",
            status: "allowed",
            risk: "low",
            reason: "Safe action",
            evaluatedAt: new Date().toISOString(),
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ acknowledged: true }),
      };
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new SentinelOps({ apiKey, baseUrl });
    const result = await client.executeWithGovernance(
      { agentId: "agent-1", action: "ping", resource: "system" },
      async () => "pong",
    );

    expect(result).toBe("pong");
    expect(mockFetch).toHaveBeenCalledTimes(2); // evaluate + reportOutcome
  });

  it("executeWithGovernance throws ActionBlockedError when denied", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        requestId: "req-blocked",
        status: "blocked",
        risk: "high",
        reason: "Destructive table drop forbidden.",
        evaluatedAt: new Date().toISOString(),
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new SentinelOps({ apiKey, baseUrl });
    await expect(
      client.executeWithGovernance(
        { agentId: "agent-1", action: "drop_table", resource: "prod_db" },
        async () => "never_run",
      ),
    ).rejects.toThrow(ActionBlockedError);
  });

  it("wrapGovernedTool protects Vercel AI SDK tools", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/evaluate")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            requestId: "req-tool",
            status: "allowed",
            risk: "low",
            reason: "Permitted query",
            evaluatedAt: new Date().toISOString(),
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ acknowledged: true }),
      };
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new SentinelOps({ apiKey, baseUrl });
    const originalTool = {
      description: "Perform SQL query",
      execute: vi.fn().mockResolvedValue({ rows: [1, 2, 3] }),
    };

    const governedTool = wrapGovernedTool(originalTool, {
      client,
      agentId: "sql-agent",
      action: "query_database",
      resourceExtractor: (args) => `database://${args.table}`,
    });

    const result = await governedTool.execute?.({ table: "orders" });
    expect(result).toEqual({ rows: [1, 2, 3] });
    expect(originalTool.execute).toHaveBeenCalledWith({ table: "orders" }, undefined);
  });

  it("SentinelOpsCallbackHandler intercepts LangChain tool executions", async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/evaluate")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            requestId: "req-langchain",
            status: "allowed",
            risk: "low",
            reason: "Authorized by LangChain policy",
            evaluatedAt: new Date().toISOString(),
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ acknowledged: true }),
      };
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = new SentinelOps({ apiKey, baseUrl });
    const handler = new SentinelOpsCallbackHandler({
      client,
      agentId: "langchain-agent",
    });

    await handler.handleToolStart(
      { name: "calculator", description: "Calculator tool" },
      { expression: "2 + 2" },
      "run-run-123",
    );

    await handler.handleToolEnd("4", "run-run-123");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
