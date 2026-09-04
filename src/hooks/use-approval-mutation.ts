"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Approval } from "@/lib/types";
import {
  OVERVIEW_QUERY_KEY,
  type OverviewDataPayload,
} from "./use-overview-query";

export interface ApprovalDecisionVariables {
  approval: Approval;
  decision: "approved" | "denied";
  reason?: string;
}

export function useApprovalMutation(options?: {
  onSuccess?: (decision: "approved" | "denied", approval: Approval) => void;
  onError?: (error: Error, approval: Approval) => void;
}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async ({ approval, decision, reason }: ApprovalDecisionVariables) => {
      const currentData = queryClient.getQueryData<OverviewDataPayload>(OVERVIEW_QUERY_KEY);
      const isLive = currentData?.mode === "live";

      if (isLive) {
        const response = await fetch(`/api/v1/actions/${approval.id}/decision`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            decision,
            reason:
              reason ||
              `${decision === "approved" ? "Approved" : "Denied"} via Operator Dashboard`,
          }),
        });

        if (!response.ok) {
          const err = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error || "Failed to submit approval decision.");
        }
        return (await response.json().catch(() => ({}))) as Record<string, unknown>;
      }

      // Demo mode simulated response
      return { simulated: true, decision, approvalId: approval.id };
    },

    onMutate: async ({ approval, decision }) => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: OVERVIEW_QUERY_KEY });

      // Snapshot the previous state
      const previousOverview =
        queryClient.getQueryData<OverviewDataPayload>(OVERVIEW_QUERY_KEY);

      // Optimistically update query cache: mark approval or remove from pending
      if (previousOverview) {
        queryClient.setQueryData<OverviewDataPayload>(OVERVIEW_QUERY_KEY, {
          ...previousOverview,
          approvals: previousOverview.approvals.map((item) =>
            item.id === approval.id
              ? { ...item, status: decision === "approved" ? "approved" : "denied" }
              : item,
          ),
        });
      }

      return { previousOverview };
    },

    onError: (err, variables, context) => {
      // Rollback to previous state on error
      if (context?.previousOverview) {
        queryClient.setQueryData(OVERVIEW_QUERY_KEY, context.previousOverview);
      }
      options?.onError?.(
        err instanceof Error ? err : new Error(String(err)),
        variables.approval,
      );
    },

    onSuccess: (_, variables) => {
      options?.onSuccess?.(variables.decision, variables.approval);
    },

    onSettled: () => {
      // Invalidate to make sure server state is synchronized
      void queryClient.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
    },
  });

  return {
    ...mutation,
    decideApproval: async (
      approval: Approval,
      decision: "approved" | "denied",
      reason?: string,
    ) => {
      return mutation.mutateAsync({ approval, decision, reason });
    },
  };
}
