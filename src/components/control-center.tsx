"use client";

import {
  Activity,
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
import { useCallback, useEffect, useState } from "react";
import { MfaVerificationDialog } from "@/components/mfa-verification-dialog";
import type { DashboardView } from "@/lib/types";
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
import { OverviewView } from "@/components/dashboard/views/overview-view";
import { AgentsView } from "@/components/dashboard/views/agents-view";
import { ActivityView } from "@/components/dashboard/views/activity-view";
import { ApprovalsView } from "@/components/dashboard/views/approvals-view";
import { PoliciesView } from "@/components/dashboard/views/policies-view";
import { AuditView } from "@/components/dashboard/views/audit-view";
import { IntegrationsView } from "@/components/dashboard/views/integrations-view";
import { SettingsView } from "@/components/dashboard/views/settings-view";
import { AccessRestrictedView } from "@/components/dashboard/views/access-restricted-view";
import {
  useControlCenterData,
  type WorkspaceMode,
} from "@/hooks/use-control-center-data";
import { useControlCenterActions } from "@/hooks/use-control-center-actions";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";

export type { DashboardView };
export type { WorkspaceMode };

export const navItems: Array<{
  id: DashboardView;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "activity", label: "Agent Activity", icon: Activity },
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
  activity: "Agent Activity & Telemetry",
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
  if (mode === "live") return null;

  return (
    <div className="mx-3 sm:mx-6 mt-3 sm:mt-4 flex items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-sentinel-line bg-gradient-to-r from-sentinel-surface via-sentinel-surface-raised to-sentinel-surface p-3.5 sm:px-5 sm:py-3 shadow-sm max-md:flex-col max-md:items-start">
      <div className="flex items-start sm:items-center gap-3 min-w-0">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border mt-0.5 sm:mt-0 ${
            mode === "connecting"
              ? "border-sentinel-amber/40 bg-sentinel-amber/15 text-sentinel-amber animate-pulse"
              : "border-sentinel-line bg-sentinel-canvas text-sentinel-muted"
          }`}
        >
          <PlugZap className="h-4 w-4 text-sentinel-lime" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className="text-xs font-semibold text-sentinel-text">
              {mode === "connecting"
                ? "Connecting to live enforcement workspace…"
                : "Development Preview Mode"}
            </strong>
            <span className="rounded bg-sentinel-canvas px-1.5 py-0.5 text-[10px] font-mono text-sentinel-muted">
              Demo Scenarios Active
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-sentinel-muted leading-relaxed break-words">
            {error ||
              "All actions and policy events are running against in-memory demo scenarios. Sign in to sync with your live database."}
          </p>
        </div>
      </div>

      <button
        type="button"
        className="primary-button text-xs py-2 sm:py-1.5 px-4 shrink-0 shadow-sm max-md:w-full max-md:justify-center"
        onClick={onConnect}
      >
        <PlugZap2 className="h-3.5 w-3.5" />
        <span>Connect Live Session</span>
      </button>
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
  const [passwordChangeOpen, setPasswordChangeOpen] = useState(false);
  const [passwordChangeRequired, setPasswordChangeRequired] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | string | null>(null);
  const [pendingMfaAction, setPendingMfaAction] = useState<null | { label: string; retry: () => Promise<void> }>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const handleSelectView = useCallback((nextView: DashboardView) => {
    setView(nextView);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("view", nextView);
      window.history.pushState({ view: nextView }, "", url.toString());
    }
  }, []);

  useKeyboardShortcuts({
    onSelectView: handleSelectView,
    onToggleShortcuts: () => setShortcutsOpen((prev) => !prev),
  });

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

  const {
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
    releaseGovernanceList,
    auditList,
    integrationList,
    refreshLiveWorkspace,
    canApprove,
    canManagePolicies,
    canGovernReleases,
    canManageOperators,
    pendingApprovals,
  } = useControlCenterData();

  const {
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
  } = useControlCenterActions({
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
  });

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
          onOpenConnect={() => {
            setWorkspaceError("");
            setConnectOpen(true);
          }}
          notificationsOpen={notificationsOpen}
          approvals={approvalList}
          quarantinedAgents={agentList.filter((a) => a.status === "quarantined")}
          onDecision={decideApproval}
          integrityVerified={true}
          onSelectView={handleSelectView}
          canDecide={canApprove}
        />

        <CommandPalette
          open={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          onSelectView={handleSelectView}
          onOpenCreatePolicy={() => handleSelectView("policies")}
          onOpenRegisterAgent={() => setRegisterOpen(true)}
          onOpenConnect={() => {
            setWorkspaceError("");
            setConnectOpen(true);
          }}
          canManageOperators={canManageOperators}
          agents={agentList}
          policies={policyList}
          approvals={approvalList}
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
                <div className="h-8 w-60 rounded-xl bg-sentinel-soft/70" />
                <div className="h-4 w-96 rounded-lg bg-sentinel-soft/40" />
              </div>
              <div className="flex gap-3">
                <div className="h-10 w-36 rounded-xl bg-sentinel-soft/60" />
                <div className="h-10 w-36 rounded-xl bg-emerald-500/15 dark:bg-sentinel-lime/15" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-sentinel-line/60 bg-sentinel-surface p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-24 rounded bg-sentinel-soft/60" />
                    <div className="h-8 w-8 rounded-lg bg-sentinel-soft/40" />
                  </div>
                  <div className="h-8 w-20 rounded bg-sentinel-soft/80" />
                  <div className="h-3 w-32 rounded bg-sentinel-soft/40" />
                </div>
              ))}
            </div>
            <div className="rounded-3xl border border-sentinel-line/60 bg-sentinel-surface p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-sentinel-line/50 pb-4">
                <div className="h-6 w-52 rounded bg-sentinel-soft/70" />
                <div className="h-8 w-32 rounded-xl bg-sentinel-soft/40" />
              </div>
              <div className="h-14 w-full rounded-xl bg-sentinel-soft/30" />
              <div className="h-14 w-full rounded-xl bg-sentinel-soft/30" />
              <div className="h-14 w-full rounded-xl bg-sentinel-soft/30" />
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
                onDecision={decideApproval}
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
            {view === "activity" && (
              <ActivityView
                events={auditList}
                agents={agentList}
              />
            )}
            {view === "approvals" && (
              <ApprovalsView
                approvals={pendingApprovals}
                releaseGovernance={releaseGovernanceList}
                operatorId={operatorIdentity?.id ?? null}
                onDecision={decideApproval}
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
            {view === "credentials" && (
              canManageOperators && operatorIdentity ? (
                <ApiKeyManagement
                  organizationName={operatorIdentity.organizationName}
                  onNotify={setToast}
                />
              ) : (
                <AccessRestrictedView
                  targetView="credentials"
                  onConnect={() => {
                    setWorkspaceError("");
                    setConnectOpen(true);
                  }}
                  onBackToOverview={() => handleSelectView("overview")}
                />
              )
            )}
            {view === "team" && (
              canManageOperators && operatorIdentity ? (
                <OperatorManagement
                  currentOperator={operatorIdentity}
                  onNotify={setToast}
                />
              ) : (
                <AccessRestrictedView
                  targetView="team"
                  onConnect={() => {
                    setWorkspaceError("");
                    setConnectOpen(true);
                  }}
                  onBackToOverview={() => handleSelectView("overview")}
                />
              )
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
        onRegister={registerAgent}
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
