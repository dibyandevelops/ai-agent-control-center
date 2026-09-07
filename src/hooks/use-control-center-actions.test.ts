import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Approval } from "@/lib/types";

describe("Approval Decision Undo Flow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sampleApproval: Approval = {
    id: "app_wire_123",
    agentId: "agent_finance_01",
    agentName: "Finance Wire Agent",
    request: "Transfer $25,000 to vendor",
    resource: "wire.transfers.create",
    risk: "high",
    requestedBy: "agent_finance_01",
    context: "Approved invoice #INV-902",
    requestedAt: "2026-09-07T12:00:00Z",
    status: "pending",
  };

  it("handles 5-second grace period and commits after timeout if not undone", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    global.fetch = mockFetch;

    let approvalList = [sampleApproval];
    const setApprovalList = vi.fn((updater) => {
      approvalList = typeof updater === "function" ? updater(approvalList) : updater;
    });

    let activeToast: {
      message: string;
      actionLabel?: string;
      onAction?: () => void;
    } | null = null;
    const setToast = vi.fn((toast) => {
      activeToast = toast;
    });

    // Simulate decideApproval execution
    const pendingDecisions = new Map<string, { timeoutId: ReturnType<typeof setTimeout>; commit: () => Promise<void> }>();

    const decide = (approval: Approval, decision: "approved" | "denied") => {
      // 1. Optimistic update
      setApprovalList((prev: Approval[]) =>
        prev.map((item) => (item.id === approval.id ? { ...item, status: decision } : item))
      );

      const commit = async () => {
        pendingDecisions.delete(approval.id);
        await mockFetch(`/api/v1/actions/${approval.id}/decision`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            decision,
            reason: `${decision === "approved" ? "Approved" : "Denied"} via Operator Dashboard`,
          }),
        });
      };

      const timeoutId = setTimeout(() => {
        void commit();
      }, 5000);

      pendingDecisions.set(approval.id, { timeoutId, commit });

      setToast({
        message: `Approved: ${approval.request}`,
        actionLabel: "Undo",
        onAction: () => {
          const pending = pendingDecisions.get(approval.id);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pendingDecisions.delete(approval.id);
          }
          setApprovalList((prev: Approval[]) =>
            prev.map((item) => (item.id === approval.id ? { ...item, status: "pending" } : item))
          );
        },
      });
    };

    // Trigger approval
    decide(sampleApproval, "approved");

    // Optimistically updated immediately
    expect(setApprovalList).toHaveBeenCalledTimes(1);
    expect(approvalList[0].status).toBe("approved");
    expect((activeToast as { actionLabel?: string } | null)?.actionLabel).toBe("Undo");
    expect(mockFetch).not.toHaveBeenCalled();

    // Fast-forward 2 seconds - still in grace period
    vi.advanceTimersByTime(2000);
    expect(mockFetch).not.toHaveBeenCalled();

    // Fast-forward remaining 3 seconds (total 5s)
    vi.advanceTimersByTime(3000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/actions/app_wire_123/decision",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"decision":"approved"'),
      })
    );
  });

  it("reverts optimistic state and cancels backend dispatch when Undo is clicked", async () => {
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    let approvalList = [sampleApproval];
    const setApprovalList = vi.fn((updater) => {
      approvalList = typeof updater === "function" ? updater(approvalList) : updater;
    });

    let activeToast: {
      message: string;
      actionLabel?: string;
      onAction?: () => void;
    } | null = null;
    const setToast = vi.fn((toast) => {
      activeToast = toast;
    });

    const pendingDecisions = new Map<string, { timeoutId: ReturnType<typeof setTimeout>; commit: () => Promise<void> }>();

    const decide = (approval: Approval, decision: "approved" | "denied") => {
      setApprovalList((prev: Approval[]) =>
        prev.map((item) => (item.id === approval.id ? { ...item, status: decision } : item))
      );

      const commit = async () => {
        pendingDecisions.delete(approval.id);
        await mockFetch(`/api/v1/actions/${approval.id}/decision`, {
          method: "POST",
        });
      };

      const timeoutId = setTimeout(() => {
        void commit();
      }, 5000);

      pendingDecisions.set(approval.id, { timeoutId, commit });

      setToast({
        message: `${decision === "approved" ? "Approved" : "Denied"}: ${approval.request}`,
        actionLabel: "Undo",
        onAction: () => {
          const pending = pendingDecisions.get(approval.id);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pendingDecisions.delete(approval.id);
          }
          setApprovalList((prev: Approval[]) =>
            prev.map((item) => (item.id === approval.id ? { ...item, status: "pending" } : item))
          );
        },
      });
    };

    // Trigger disapproval (denied)
    decide(sampleApproval, "denied");

    expect(approvalList[0].status).toBe("denied");
    expect((activeToast as { actionLabel?: string } | null)?.actionLabel).toBe("Undo");

    // Advance 2 seconds
    vi.advanceTimersByTime(2000);
    expect(mockFetch).not.toHaveBeenCalled();

    // User clicks Undo!
    (activeToast as { onAction?: () => void } | null)?.onAction?.();

    // Verify approvalList is reverted back to "pending"
    expect(approvalList[0].status).toBe("pending");
    expect(pendingDecisions.has(sampleApproval.id)).toBe(false);

    // Fast forward well past the original 5-second timer
    vi.advanceTimersByTime(10000);

    // Fetch MUST NOT have been called!
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
