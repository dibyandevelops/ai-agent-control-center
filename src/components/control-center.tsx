"use client";

import {
  Bot,
  ClipboardCheck,
  FileClock,
  KeyRound,
  LayoutDashboard,
  PlugZap,
  PlugZap2,
  Settings,
  Shield,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  agents as initialAgents,
  approvals as initialApprovals,
  auditEvents as initialAuditEvents,
  integrations,
  policies as initialPolicies,
} from "@/lib/demo-data";
import { MfaVerificationDialog } from "@/components/mfa-verification-dialog";
import type {
  Agent,
  Approval,
  AuditEvent,
  DashboardView,
  Integration,
  OperatorIdentity,
  Policy,
  PolicyActivationRequest,
  ReleaseGovernanceQueueItem,
} from "@/lib/types";
import { OperatorManagement } from "@/components/operator-management";
import { PasswordChangeDialog } from "@/components/password-change-dialog";
import { ApiKeyManagement } from "@/components/api-key-management";
import { CommandPalette } from "@/components/command-palette";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { ToastNotification, type ToastData } from "@/components/toast-notification";
import { TopBar } from "@/components/dashboard/navigation/topbar";
import { Sidebar } from "@/components/dashboard/navigation/sidebar";
import { ActionDetailDrawer } from "@/components/dashboard/drawers/action-detail-drawer";
import { RegisterDialog } from "@/components/dashboard/dialogs/register-agent-dialog";
import { LiveConnectionDialog } from "@/components/dashboard/dialogs/live-connection-dialog";
export type { DashboardView } from "@/lib/types";
import { OverviewView } from "@/components/dashboard/views/overview-view";
import { AgentsView } from "@/components/dashboard/views/agents-view";
import { ApprovalsView } from "@/components/dashboard/views/approvals-view";
import { PoliciesView } from "@/components/dashboard/views/policies-view";
import { AuditView } from "@/components/dashboard/views/audit-view";
import { IntegrationsView } from "@/components/dashboard/views/integrations-view";
import { SettingsView } from "@/components/dashboard/views/settings-view";

type WorkspaceMode = "demo" | "connecting" | "live";

interface LiveControlCenterPayload {
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

export const navItems: Array<{
  id: DashboardView;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "approvals", label: "Approvals", icon: ClipboardCheck },
  { id: "policies", label: "Policies", icon: Shield },
  { id: "audit", label: "Audit log", icon: FileClock },
  { id: "integrations", label: "Integrations", icon: PlugZap },
  { id: "credentials", label: "Credentials", icon: KeyRound, adminOnly: true },
  { id: "team", label: "Team access", icon: UsersRound, adminOnly: true },
  { id: "settings", label: "Settings", icon: Settings },
];

export const titles: Record<DashboardView, string> = {
  overview: "Control center",
  agents: "Agent registry",
  approvals: "Approval queue",
  policies: "Policy engine",
  audit: "Audit log",
  integrations: "Integrations",
  credentials: "Agent credentials",
  team: "Team access",
  settings: "Settings & Preferences",
};

function WorkspaceBanner({
  mode,
  error,
  onConnect,
}: {
  mode: WorkspaceMode;
  error: string;
  onConnect: () => void;
}) {
  return (
    <div className="mx-7 mt-4 flex min-h-12 items-center gap-3 rounded-lg border border-sentinel-line bg-sentinel-surface px-4 text-xs max-md:mx-4 max-md:items-start max-md:py-3">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          mode === "live"
            ? "bg-sentinel-lime shadow-[0_0_12px_rgba(183,243,74,0.55)]"
            : mode === "connecting"
              ? "animate-pulse bg-sentinel-amber"
              : "bg-sentinel-muted"
        }`}
      />
      <div className="flex-1">
        <strong className="font-semibold text-sentinel-text">
          {mode === "live"
            ? "Live enforcement workspace"
            : mode === "connecting"
              ? "Connecting to live workspace"
              : "Development preview"}
        </strong>
        <span className="ml-2 text-sentinel-muted max-md:ml-0 max-md:mt-1 max-md:block">
          {error ||
            (mode === "live"
              ? "Requests, approvals, policies, and evidence are loaded from PostgreSQL."
              : "The interface is using local demo data until you connect an operator session.")}
        </span>
      </div>
      {mode !== "live" ? (
        <button
          type="button"
          className="secondary-button shrink-0"
          onClick={onConnect}
        >
          <PlugZap className="h-3.5 w-3.5" /> Connect live
        </button>
      ) : null}
    </div>
  );
}

export function ControlCenter({
  initialView = "overview",
  initialAuditEventId,
}: {
  initialView?: DashboardView;
  initialAuditEventId?: string;
}) {
  const [view, setView] = useState<DashboardView>(initialView);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("connecting");
  const [workspaceError, setWorkspaceError] = useState("");
  const [operatorIdentity, setOperatorIdentity] = useState<OperatorIdentity | null>(null);
  const [agentList, setAgentList] = useState(initialAgents);
  const [approvalList, setApprovalList] = useState(initialApprovals);
  const [policyList, setPolicyList] = useState(initialPolicies);
  const [policyActivationList, setPolicyActivationList] = useState<PolicyActivationRequest[]>([]);
  const [releaseGovernanceList, setReleaseGovernanceList] = useState<ReleaseGovernanceQueueItem[]>([]);
  const [auditList, setAuditList] = useState(initialAuditEvents);
  const [integrationList, setIntegrationList] = useState(integrations);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | string | null>(null);
  const [pendingMfaAction, setPendingMfaAction] = useState<null | { label: string; retry: () => Promise<void> }>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pendingKeySeqRef = useRef<string | null>(null);
  const keySeqTimerRef = useRef<number | null>(null);

  const handleSelectView = useCallback((nextView: DashboardView) => {
    setView(nextView);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", nextView);
      window.history.pushState({ view: nextView }, "", url.toString());
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) {
        pendingKeySeqRef.current = "g";
        if (keySeqTimerRef.current) window.clearTimeout(keySeqTimerRef.current);
        keySeqTimerRef.current = window.setTimeout(() => {
          pendingKeySeqRef.current = null;
        }, 1200);
        return;
      }

      if (pendingKeySeqRef.current === "g") {
        const key = e.key.toLowerCase();
        pendingKeySeqRef.current = null;
        if (key === "o") { e.preventDefault(); handleSelectView("overview"); }
        else if (key === "a") { e.preventDefault(); handleSelectView("agents"); }
        else if (key === "p") { e.preventDefault(); handleSelectView("policies"); }
        else if (key === "i") { e.preventDefault(); handleSelectView("integrations"); }
        else if (key === "u") { e.preventDefault(); handleSelectView("audit"); }
        else if (key === "c") { e.preventDefault(); handleSelectView("credentials"); }
        else if (key === "t") { e.preventDefault(); handleSelectView("team"); }
        else if (key === "s") { e.preventDefault(); handleSelectView("settings"); }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSelectView]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("view");
      const validViews = [
        "overview",
        "agents",
        "approvals",
        "policies",
        "audit",
        "integrations",
        "credentials",
        "team",
        "settings",
      ];
      if (requested && validViews.includes(requested)) {
        setView(requested as DashboardView);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("resetToken");
      if (token) setResetToken(token);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
    const response = await fetch("/api/v1/control-center", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || "Unable to load live workspace.");
    }
    applyLivePayload((await response.json()) as LiveControlCenterPayload);
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
    let unmounted = false;
    async function init() {
      try {
        const response = await fetch("/api/v1/control-center", { cache: "no-store" });
        if (unmounted) return;
        if (response.ok) {
          applyLivePayload((await response.json()) as LiveControlCenterPayload);
        } else {
          setWorkspaceMode("demo");
        }
      } catch {
        if (!unmounted) setWorkspaceMode("demo");
      }
    }
    void init();
    return () => {
      unmounted = true;
    };
  }, [applyLivePayload]);

  useEffect(() => {
    if (workspaceMode !== "live") return;
    const interval = window.setInterval(() => {
      void refreshLiveWorkspace().catch(() => {});
    }, 4000);
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
  const canManageOperators =
    workspaceMode === "demo" || operatorIdentity?.role === "admin";

  const pendingApprovals = useMemo(
    () => approvalList.filter((a) => a.status === "pending"),
    [approvalList],
  );

  async function register(newAgent: Agent) {
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

  async function decide(approval: Approval, decision: "approved" | "denied") {
    if (workspaceMode === "live") {
      const response = await fetch(`/api/v1/actions/${approval.id}/decision`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
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

  return (
    <div className="app-shell">
      <Sidebar
        view={view}
        open={sidebarOpen}
        collapsed={sidebarCollapsed}
        pendingCount={pendingApprovals.length}
        canManageOperators={canManageOperators}
        onSelect={handleSelectView}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />

      <div
        className={`main-layout ${
          sidebarCollapsed ? "main-layout-collapsed" : ""
        }`}
      >
        <TopBar
          view={view}
          viewTitles={titles}
          operator={operatorIdentity}
          onMenu={() => setSidebarOpen(true)}
          onChangePassword={() => {
            if (!operatorIdentity) return;
            setPasswordChangeRequired(operatorIdentity.mustChangePassword);
            setPasswordChangeError("");
            setPasswordChangeOpen(true);
          }}
          onLogout={() => void logout()}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onToggleNotifications={() => setNotificationsOpen((prev) => !prev)}
          notificationsOpen={notificationsOpen}
          approvals={approvalList}
          quarantinedAgents={agentList.filter((a) => a.status === "quarantined")}
          onDecision={decide}
          integrityVerified={true}
          onSelectView={handleSelectView}
          canDecide={canApprove}
        />

        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onSelectView={handleSelectView}
          onOpenCreatePolicy={() => handleSelectView("policies")}
          agents={agentList}
          policies={policyList}
        />

        <WorkspaceBanner
          mode={workspaceMode}
          error={workspaceError}
          onConnect={() => {
            setWorkspaceError("");
            setConnectOpen(true);
          }}
        />

        {workspaceMode === "connecting" ? (
          <main className="page animate-pulse space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-8 w-60 rounded-xl bg-sentinel-line" />
                <div className="h-4 w-96 rounded-lg bg-sentinel-line/60" />
              </div>
              <div className="flex gap-3">
                <div className="h-10 w-36 rounded-xl bg-sentinel-line" />
                <div className="h-10 w-36 rounded-xl bg-emerald-500/20 dark:bg-sentinel-lime/20" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-24 rounded bg-sentinel-line/70" />
                    <div className="h-8 w-8 rounded-lg bg-sentinel-line/50" />
                  </div>
                  <div className="h-8 w-20 rounded bg-sentinel-line" />
                  <div className="h-3 w-32 rounded bg-sentinel-line/50" />
                </div>
              ))}
            </div>
            <div className="rounded-3xl border border-sentinel-line bg-sentinel-surface p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-sentinel-line/60 pb-4">
                <div className="h-6 w-52 rounded bg-sentinel-line" />
                <div className="h-8 w-32 rounded-xl bg-sentinel-line/50" />
              </div>
              <div className="h-14 w-full rounded-xl bg-sentinel-line/30" />
              <div className="h-14 w-full rounded-xl bg-sentinel-line/30" />
              <div className="h-14 w-full rounded-xl bg-sentinel-line/30" />
            </div>
          </main>
        ) : (
          <>
            {view === "overview" && (
              <OverviewView
                agents={agentList}
                approvals={pendingApprovals}
                audit={auditList}
                operator={operatorIdentity}
                live={workspaceMode === "live"}
                onRegister={() => setRegisterOpen(true)}
                onDecision={decide}
                onViewApprovals={() => handleSelectView("approvals")}
                onOpenCredentials={() => handleSelectView("credentials")}
                onOpenIntegrations={() => handleSelectView("integrations")}
                onOpenPolicies={() => handleSelectView("policies")}
                canDecide={canApprove}
              />
            )}
            {view === "agents" && (
              <AgentsView
                agents={agentList}
                audit={auditList}
                onRegister={() => setRegisterOpen(true)}
                onQuarantine={
                  canManagePolicies || canApprove
                    ? handleQuarantineAgent
                    : undefined
                }
                onLiftQuarantine={
                  canManagePolicies || canApprove
                    ? handleUnquarantineAgent
                    : undefined
                }
              />
            )}
            {view === "approvals" && (
              <ApprovalsView
                approvals={pendingApprovals}
                releaseGovernance={releaseGovernanceList}
                operatorId={operatorIdentity?.id ?? null}
                onDecision={decide}
                onReleaseDecision={decideReleaseGovernance}
                onReleaseRetry={retryReleaseGovernance}
                onViewEvidence={setSelectedRequestId}
                canDecide={canApprove}
                canGovernReleases={canGovernReleases}
              />
            )}
            {view === "policies" && (
              <PoliciesView
                policies={policyList}
                activations={policyActivationList}
                audit={auditList}
                operatorId={operatorIdentity?.id ?? "demo-operator"}
                onToggle={togglePolicy}
                onSaved={savePolicy}
                onActivationDecision={decidePolicyActivation}
                onRefresh={refreshLiveWorkspace}
                canManage={canManagePolicies}
              />
            )}
            {view === "audit" && (
              <AuditView
                audit={auditList}
                onOpenDetails={setSelectedRequestId}
                initialEventId={initialAuditEventId}
              />
            )}
            {view === "integrations" && (
              <IntegrationsView
                items={integrationList}
                live={workspaceMode === "live"}
                canRetryDeadLetters={canManagePolicies}
                onRetryDeadLetters={retryDeadNotifications}
                canAcknowledgeDrift={canGovernReleases}
                onAcknowledgeDrift={acknowledgeGitHubDrift}
                onResolveDrift={resolveGitHubDrift}
                onViewEvidence={setSelectedRequestId}
                onRefresh={refreshLiveWorkspace}
                onNotify={setToast}
              />
            )}
            {view === "credentials" && operatorIdentity?.role === "admin" && (
              <ApiKeyManagement
                organizationName={operatorIdentity.organizationName}
                onNotify={setToast}
              />
            )}
            {view === "team" && operatorIdentity?.role === "admin" && (
              <OperatorManagement
                currentOperator={operatorIdentity}
                onNotify={setToast}
              />
            )}
            {view === "settings" && (
              <SettingsView
                operator={operatorIdentity}
                canManageOperators={canManageOperators}
                integrityVerified={true}
                onVerifyIntegrity={async () => {
                  const res = await fetch("/api/v1/audit/integrity");
                  const data = await res.json();
                  if (data.verified) {
                    setToast({
                      message: "Cryptographic SHA-256 seal verified.",
                      type: "success",
                    });
                  } else {
                    setToast({
                      message: data.error || "Hash chain mismatch.",
                      type: "error",
                    });
                  }
                }}
                onUpdateOperatorName={(newName) => {
                  setOperatorIdentity((prev) =>
                    prev ? { ...prev, displayName: newName } : prev,
                  );
                  setToast("Profile display name updated.");
                }}
                onUpdateOrgName={(newOrgName) => {
                  setOperatorIdentity((prev) =>
                    prev ? { ...prev, organizationName: newOrgName } : prev,
                  );
                  setToast("Organization name updated.");
                }}
                onChangePassword={() => {
                  if (!operatorIdentity) return;
                  setPasswordChangeRequired(operatorIdentity.mustChangePassword);
                  setPasswordChangeError("");
                  setPasswordChangeOpen(true);
                }}
                onSelectView={handleSelectView}
              />
            )}
          </>
        )}
      </div>

      <RegisterDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onRegister={register}
      />
      <LiveConnectionDialog
        open={connectOpen}
        loading={connectLoading}
        error={workspaceError}
        onClose={() => setConnectOpen(false)}
        onConnect={connectLiveWorkspace}
        onSso={connectLiveWorkspaceWithSso}
      />
      {(passwordChangeOpen || Boolean(resetToken)) ? (
        <PasswordChangeDialog
          loading={passwordChangeLoading}
          serverError={passwordChangeError}
          required={passwordChangeRequired}
          onClose={() => {
            if (passwordChangeRequired) return;
            setPasswordChangeOpen(false);
            setResetToken(null);
          }}
          onSubmit={async (currentPassword, newPassword) => {
            setPasswordChangeLoading(true);
            setPasswordChangeError("");
            try {
              const endpoint = resetToken
                ? "/api/v1/session/reset-password"
                : "/api/v1/session/password";
              const body = resetToken
                ? { token: resetToken, newPassword }
                : { currentPassword, newPassword };
              const response = await fetch(endpoint, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
              });
              const payload = (await response.json()) as { error?: string };
              if (!response.ok) {
                throw new Error(payload.error || "Password change failed.");
              }
              setPasswordChangeOpen(false);
              setResetToken(null);
              setPasswordChangeRequired(false);
              setToast("Password updated successfully.");
            } catch (err) {
              setPasswordChangeError(
                err instanceof Error ? err.message : "Password change failed.",
              );
            } finally {
              setPasswordChangeLoading(false);
            }
          }}
        />
      ) : null}
      {pendingMfaAction ? (
        <MfaVerificationDialog
          actionLabel={pendingMfaAction.label}
          onClose={() => setPendingMfaAction(null)}
          onVerified={async () => {
            const action = pendingMfaAction;
            setPendingMfaAction(null);
            await action.retry();
          }}
        />
      ) : null}
      <ShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <ActionDetailDrawer
        requestId={selectedRequestId}
        onClose={() => setSelectedRequestId(null)}
        canRetryExecution={canGovernReleases}
        onExecutionRetried={refreshLiveWorkspace}
        onNotify={setToast}
        operatorId={operatorIdentity?.id ?? null}
        canGovernReleases={canGovernReleases}
      />
      <ToastNotification toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
