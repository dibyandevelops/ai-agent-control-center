"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  agents as initialAgents,
  approvals as initialApprovals,
  auditEvents as initialAuditEvents,
  integrations,
  policies as initialPolicies,
} from "@/lib/demo-data";

export type WorkspaceMode = "demo" | "connecting" | "live";

export interface LiveControlCenterPayload {
  mode: "live";
  operator: OperatorIdentity;
  agents: Agent[];
  approvals: Approval[];
  policies: Policy[];
  policyActivations: PolicyActivationRequest[];
  releaseGovernance: ReleaseGovernanceQueueItem[];
  audit: AuditEvent[];
  integrations: Integration[];
}

export function useControlCenterData() {
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("connecting");
  const [workspaceError, setWorkspaceError] = useState("");
  const [operatorIdentity, setOperatorIdentity] = useState<OperatorIdentity | null>(null);
  const [agentList, setAgentList] = useState<Agent[]>(initialAgents);
  const [approvalList, setApprovalList] = useState<Approval[]>(initialApprovals);
  const [policyList, setPolicyList] = useState<Policy[]>(initialPolicies);
  const [policyActivationList, setPolicyActivationList] = useState<PolicyActivationRequest[]>([]);
  const [releaseGovernanceList, setReleaseGovernanceList] = useState<ReleaseGovernanceQueueItem[]>([]);
  const [auditList, setAuditList] = useState<AuditEvent[]>(initialAuditEvents);
  const [integrationList, setIntegrationList] = useState<Integration[]>(integrations);
  const [hydrated, setHydrated] = useState(false);
  const activeAbortControllerRef = useRef<AbortController | null>(null);

  const applyLivePayload = useCallback((payload: LiveControlCenterPayload) => {
    setAgentList(payload.agents);
    setApprovalList(payload.approvals);
    setPolicyList(payload.policies);
    setPolicyActivationList(payload.policyActivations);
    setReleaseGovernanceList(payload.releaseGovernance);
    setAuditList(payload.audit);
    setIntegrationList(payload.integrations);
    setOperatorIdentity(payload.operator);
    setWorkspaceMode("live");
    setWorkspaceError("");
  }, []);

  const refreshLiveWorkspace = useCallback(async () => {
    // Abort any prior in-flight request before launching new fetch
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    activeAbortControllerRef.current = controller;

    try {
      const response = await fetch("/api/v1/control-center", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Unable to load live workspace.");
      }
      applyLivePayload((await response.json()) as LiveControlCenterPayload);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // gracefully ignore cancelled request
      }
      throw err;
    }
  }, [applyLivePayload]);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem("sentinelops-demo-state");
        if (saved) {
          const parsed = JSON.parse(saved) as {
            agents?: Agent[];
            approvals?: Approval[];
            policies?: Policy[];
            audit?: AuditEvent[];
          };
          if (parsed.agents?.length) setAgentList(parsed.agents);
          if (parsed.approvals?.length) setApprovalList(parsed.approvals);
          if (parsed.policies?.length) setPolicyList(parsed.policies);
          if (parsed.audit?.length) setAuditList(parsed.audit);
        }
      } catch {
        // demo state parsing fallback
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    if (!hydrated || workspaceMode === "live") return;
    try {
      window.localStorage.setItem(
        "sentinelops-demo-state",
        JSON.stringify({
          agents: agentList,
          approvals: approvalList,
          policies: policyList,
          audit: auditList,
        }),
      );
    } catch {
      // storage unavailable
    }
  }, [agentList, approvalList, policyList, auditList, workspaceMode, hydrated]);

  useEffect(() => {
    const controller = new AbortController();
    async function init() {
      try {
        const response = await fetch("/api/v1/control-center", {
          signal: controller.signal,
          cache: "no-store",
        });
        if (response.ok) {
          applyLivePayload((await response.json()) as LiveControlCenterPayload);
        } else {
          setWorkspaceMode("demo");
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        setWorkspaceMode("demo");
      }
    }
    void init();
    return () => {
      controller.abort();
    };
  }, [applyLivePayload]);

  useEffect(() => {
    return () => {
      activeAbortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (workspaceMode !== "live") return;
    const interval = window.setInterval(() => {
      void refreshLiveWorkspace().catch(() => {});
    }, 5000);
    return () => window.clearInterval(interval);
  }, [workspaceMode, refreshLiveWorkspace]);

  const canApprove =
    workspaceMode === "demo" ||
    operatorIdentity?.role === "admin" ||
    operatorIdentity?.role === "approver";

  const canManagePolicies =
    workspaceMode === "demo" ||
    operatorIdentity?.role === "admin";

  const canGovernReleases =
    workspaceMode === "demo" || operatorIdentity?.role === "admin";

  const canManageOperators = Boolean(operatorIdentity?.role === "admin");

  const pendingApprovals = useMemo(
    () => approvalList.filter((a) => a.status === "pending"),
    [approvalList],
  );

  return {
    workspaceMode,
    setWorkspaceMode,
    workspaceError,
    setWorkspaceError,
    operatorIdentity,
    setOperatorIdentity,
    agentList,
    setAgentList,
    approvalList,
    setApprovalList,
    policyList,
    setPolicyList,
    policyActivationList,
    setPolicyActivationList,
    releaseGovernanceList,
    setReleaseGovernanceList,
    auditList,
    setAuditList,
    integrationList,
    setIntegrationList,
    hydrated,
    applyLivePayload,
    refreshLiveWorkspace,
    canApprove,
    canManagePolicies,
    canGovernReleases,
    canManageOperators,
    pendingApprovals,
  };
}
