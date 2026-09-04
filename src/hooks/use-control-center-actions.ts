"use client";

import { useState } from "react";
import type {
  Agent,
  Approval,
  OperatorIdentity,
  Policy,
} from "@/lib/types";
import type { ToastData } from "@/components/toast-notification";
import type { WorkspaceMode } from "./use-control-center-data";

interface UseControlCenterActionsOptions {
  workspaceMode: WorkspaceMode;
  refreshLiveWorkspace: () => Promise<void>;
  setAgentList: React.Dispatch<React.SetStateAction<Agent[]>>;
  setApprovalList: React.Dispatch<React.SetStateAction<Approval[]>>;
  setPolicyList: React.Dispatch<React.SetStateAction<Policy[]>>;
  policyList: Policy[];
  setOperatorIdentity: React.Dispatch<React.SetStateAction<OperatorIdentity | null>>;
  setWorkspaceMode: React.Dispatch<React.SetStateAction<WorkspaceMode>>;
  setWorkspaceError: (error: string) => void;
  setToast: (toast: ToastData | string | null) => void;
  setRegisterOpen: (open: boolean) => void;
  setConnectOpen: (open: boolean) => void;
}

export function useControlCenterActions({
  workspaceMode,
  refreshLiveWorkspace,
  setAgentList,
  setApprovalList,
  setPolicyList,
  policyList,
  setOperatorIdentity,
  setWorkspaceMode,
  setWorkspaceError,
  setToast,
  setRegisterOpen,
  setConnectOpen,
}: UseControlCenterActionsOptions) {
  const [connectLoading, setConnectLoading] = useState(false);

  async function registerAgent(newAgent: Agent) {
    if (workspaceMode === "live") {
      const response = await fetch("/api/v1/agents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newAgent.name,
          owner: newAgent.owner,
          team: newAgent.team,
          provider: newAgent.provider,
          description: newAgent.description,
        }),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Failed to register agent");
      }
      await refreshLiveWorkspace();
      setToast(`Agent "${newAgent.name}" successfully registered.`);
    } else {
      setAgentList((prev) => [newAgent, ...prev]);
      setToast(`Agent "${newAgent.name}" registered in demo workspace.`);
    }
    setRegisterOpen(false);
  }

  async function decideApproval(
    approval: Approval,
    decision: "approved" | "denied",
    reason?: string,
  ) {
    if (workspaceMode === "live") {
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
        throw new Error(err.error || "Decision failed");
      }
      await refreshLiveWorkspace();
    } else {
      setApprovalList((prev) =>
        prev.map((item) =>
          item.id === approval.id
            ? { ...item, status: decision === "approved" ? "approved" : "denied" }
            : item,
        ),
      );
    }
    setToast(
      decision === "approved"
        ? `Approved: ${approval.request}`
        : `Denied: ${approval.request}`,
    );
  }

  async function decideReleaseGovernance(
    governanceId: string,
    decision: "approved" | "rejected",
    reason: string,
  ) {
    if (workspaceMode === "live") {
      const response = await fetch(
        `/api/v1/release-governance/${governanceId}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision, reason }),
        },
      );
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Governance decision failed");
      }
      await refreshLiveWorkspace();
      setToast(`Release operation ${decision}.`);
    }
  }

  async function retryReleaseGovernance(governanceId: string) {
    if (workspaceMode === "live") {
      const response = await fetch(
        `/api/v1/release-governance/${governanceId}/retry`,
        { method: "POST" },
      );
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Retry failed");
      }
      await refreshLiveWorkspace();
      setToast("Release execution requeued.");
    }
  }

  async function togglePolicy(policyId: string) {
    const policy = policyList.find((p) => p.id === policyId);
    if (!policy) return;

    if (workspaceMode === "live") {
      const response = await fetch(`/api/v1/policies/${policyId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !policy.enabled }),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Policy toggle failed");
      }
      await refreshLiveWorkspace();
    } else {
      setPolicyList((prev) =>
        prev.map((item) =>
          item.id === policyId ? { ...item, enabled: !item.enabled } : item,
        ),
      );
    }
    setToast(
      !policy.enabled
        ? `Enabled policy: ${policy.name}`
        : `Disabled policy: ${policy.name}`,
    );
  }

  function savePolicy(savedPolicy: Policy) {
    if (workspaceMode === "live") {
      void refreshLiveWorkspace();
    } else {
      setPolicyList((prev) => {
        const exists = prev.some((p) => p.id === savedPolicy.id);
        if (exists) {
          return prev.map((p) => (p.id === savedPolicy.id ? savedPolicy : p));
        }
        return [savedPolicy, ...prev];
      });
    }
    setToast(`Saved policy: ${savedPolicy.name}`);
  }

  async function decidePolicyActivation(
    requestId: string,
    decision: "approved" | "rejected",
    reason: string,
  ) {
    if (workspaceMode === "live") {
      const response = await fetch(
        `/api/v1/policies/activation-requests/${requestId}/decision`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ decision, reason }),
        },
      );
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Activation decision failed");
      }
      await refreshLiveWorkspace();
      setToast(`Policy activation ${decision}.`);
    }
  }

  async function handleQuarantineAgent(agent: Agent, reason: string) {
    if (workspaceMode === "live") {
      const response = await fetch(`/api/v1/agents/${agent.id}/quarantine`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Quarantine failed");
      }
      await refreshLiveWorkspace();
    } else {
      setAgentList((prev) =>
        prev.map((a) =>
          a.id === agent.id ? { ...a, status: "quarantined" } : a,
        ),
      );
    }
    setToast({
      message: `Killswitch activated: ${agent.name} quarantined.`,
      type: "error",
    });
  }

  async function handleUnquarantineAgent(agent: Agent, reason: string) {
    if (workspaceMode === "live") {
      const response = await fetch(`/api/v1/agents/${agent.id}/unquarantine`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Unquarantine failed");
      }
      await refreshLiveWorkspace();
    } else {
      setAgentList((prev) =>
        prev.map((a) => (a.id === agent.id ? { ...a, status: "healthy" } : a)),
      );
    }
    setToast({
      message: `Quarantine lifted: ${agent.name} restored.`,
      type: "success",
    });
  }

  async function retryDeadNotifications() {
    if (workspaceMode === "live") {
      const response = await fetch("/api/v1/notifications/retry-dead", {
        method: "POST",
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Retry failed");
      }
      await refreshLiveWorkspace();
      setToast("Retrying dead letter notifications.");
    }
  }

  async function acknowledgeGitHubDrift(incidentId: string, note: string) {
    if (workspaceMode === "live") {
      const response = await fetch(
        `/api/v1/github-drift/${incidentId}/acknowledge`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ note }),
        },
      );
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Acknowledge failed");
      }
      await refreshLiveWorkspace();
      setToast("GitHub drift acknowledged.");
    }
  }

  async function resolveGitHubDrift(incidentId: string, note: string) {
    if (workspaceMode === "live") {
      const response = await fetch(
        `/api/v1/github-drift/${incidentId}/resolve`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ note }),
        },
      );
      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || "Resolve failed");
      }
      await refreshLiveWorkspace();
      setToast("GitHub drift resolved.");
    }
  }

  async function connectLiveWorkspace(email: string, password: string) {
    setConnectLoading(true);
    setWorkspaceError("");
    try {
      const response = await fetch("/api/v1/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Connection failed.");
      }
      await refreshLiveWorkspace();
      setConnectOpen(false);
      setToast("Signed in to live workspace.");
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setConnectLoading(false);
    }
  }

  async function connectLiveWorkspaceWithSso(email: string) {
    setConnectLoading(true);
    setWorkspaceError("");
    try {
      const response = await fetch("/api/v1/sso/saml/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await response.json()) as { error?: string; redirectUrl?: string };
      if (!response.ok || !data.redirectUrl) {
        throw new Error(data.error || "SSO redirect failed.");
      }
      window.location.href = data.redirectUrl;
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : "SSO start failed.");
      setConnectLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/v1/session", { method: "DELETE" });
    } finally {
      setOperatorIdentity(null);
      setWorkspaceMode("demo");
      setToast("Logged out of live session.");
    }
  }

  return {
    connectLoading,
    registerAgent,
    decideApproval,
    decideReleaseGovernance,
    retryReleaseGovernance,
    togglePolicy,
    savePolicy,
    decidePolicyActivation,
    handleQuarantineAgent,
    handleUnquarantineAgent,
    retryDeadNotifications,
    acknowledgeGitHubDrift,
    resolveGitHubDrift,
    connectLiveWorkspace,
    connectLiveWorkspaceWithSso,
    logout,
  };
}
