"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Agent,
  Approval,
  AuditEvent,
  Integration,
  OperatorIdentity,
  Policy,
  PolicyActivationRequest,
  ReleaseGovernanceQueueItem,
} from "@/lib/types";
import {
  agents as demoAgents,
  approvals as demoApprovals,
  auditEvents as demoAudit,
  integrations as demoIntegrations,
  policies as demoPolicies,
} from "@/lib/demo-data";

export interface OverviewDataPayload {
  mode: "live" | "demo";
  operator: OperatorIdentity | null;
  agents: Agent[];
  approvals: Approval[];
  policies: Policy[];
  policyActivations: PolicyActivationRequest[];
  releaseGovernance: ReleaseGovernanceQueueItem[];
  audit: AuditEvent[];
  integrations: Integration[];
}

export const OVERVIEW_QUERY_KEY = ["control-center", "overview"] as const;

export function resolveOverviewApprovals(
  workspaceApprovals: Approval[] | undefined,
  queryApprovals: Approval[] | undefined,
) {
  // The dashboard owns approval mutations. Prefer that state, including an
  // empty list, so a stale background query cannot resurrect a decided card.
  return workspaceApprovals ?? queryApprovals ?? [];
}

export async function fetchOverviewData({
  signal,
}: { signal?: AbortSignal } = {}): Promise<OverviewDataPayload> {
  try {
    const response = await fetch("/api/v1/control-center", {
      signal,
      cache: "no-store",
    });
    if (!response.ok) {
      // In demo mode or unauthenticated preview, construct fallback payload
      let savedState: {
        agents?: Agent[];
        approvals?: Approval[];
        policies?: Policy[];
        audit?: AuditEvent[];
      } = {};
      if (typeof window !== "undefined") {
        try {
          const saved = window.localStorage.getItem("sentinelops-demo-state");
          if (saved) savedState = JSON.parse(saved);
        } catch {
          // local storage fallback
        }
      }

      return {
        mode: "demo",
        operator: null,
        agents: savedState.agents?.length ? savedState.agents : demoAgents,
        approvals: savedState.approvals?.length ? savedState.approvals : demoApprovals,
        policies: savedState.policies?.length ? savedState.policies : demoPolicies,
        policyActivations: [],
        releaseGovernance: [],
        audit: savedState.audit?.length ? savedState.audit : demoAudit,
        integrations: demoIntegrations,
      };
    }

    const json = (await response.json()) as OverviewDataPayload;
    return json;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }
    return {
      mode: "demo",
      operator: null,
      agents: demoAgents,
      approvals: demoApprovals,
      policies: demoPolicies,
      policyActivations: [],
      releaseGovernance: [],
      audit: demoAudit,
      integrations: demoIntegrations,
    };
  }
}

export interface UseOverviewQueryOptions {
  initialData?: Partial<OverviewDataPayload>;
  enabled?: boolean;
}

export function useOverviewQuery(options?: UseOverviewQueryOptions) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: OVERVIEW_QUERY_KEY,
    queryFn: ({ signal }) => fetchOverviewData({ signal }),
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    refetchInterval: (query) => {
      // In live workspace mode, poll every 5 seconds for telemetry updates
      return query.state.data?.mode === "live" ? 5_000 : false;
    },
    // Use placeholderData to prevent re-renders from recreating inline initialData and looping
    placeholderData: options?.initialData
      ? {
          mode: options.initialData.mode ?? "demo",
          operator: options.initialData.operator ?? null,
          agents: options.initialData.agents ?? demoAgents,
          approvals: options.initialData.approvals ?? demoApprovals,
          policies: options.initialData.policies ?? demoPolicies,
          policyActivations: options.initialData.policyActivations ?? [],
          releaseGovernance: options.initialData.releaseGovernance ?? [],
          audit: options.initialData.audit ?? demoAudit,
          integrations: options.initialData.integrations ?? demoIntegrations,
        }
      : undefined,
    enabled: options?.enabled ?? true,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });

  return {
    ...query,
    invalidate,
    isLive: query.data?.mode === "live",
    agents: query.data?.agents ?? demoAgents,
    approvals: query.data?.approvals ?? demoApprovals,
    pendingApprovals: (query.data?.approvals ?? demoApprovals).filter(
      (a) => a.status === "pending",
    ),
    audit: query.data?.audit ?? demoAudit,
    operator: query.data?.operator ?? null,
  };
}
