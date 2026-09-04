"use client";

import {
  Bell,
  Building2,
  ChevronDown,
  Command,
  KeyRound,
  LogIn,
  LogOut,
  Menu,
  PlugZap,
  Search,
  Sparkles,
} from "lucide-react";
import React from "react";
import type { Agent, Approval, DashboardView, OperatorIdentity } from "@/lib/types";
import { NotificationPopover } from "@/components/notification-popover";
import { ThemeToggle } from "@/components/theme-toggle";

export function TopBar({
  view,
  operator,
  onMenu,
  onLogout,
  onChangePassword,
  onOpenCommandPalette,
  onToggleNotifications,
  onOpenConnect,
  notificationsOpen,
  approvals = [],
  quarantinedAgents = [],
  onDecision,
  integrityVerified,
  onSelectView,
  canDecide = false,
  viewTitles,
}: {
  view: DashboardView;
  operator: OperatorIdentity | null;
  onMenu: () => void;
  onLogout: () => void;
  onChangePassword: () => void;
  onOpenCommandPalette: () => void;
  onToggleNotifications: () => void;
  onOpenConnect?: () => void;
  notificationsOpen: boolean;
  approvals?: Approval[];
  quarantinedAgents?: Agent[];
  onDecision?: (approval: Approval, decision: "approved" | "denied") => Promise<void>;
  integrityVerified: boolean;
  onSelectView: (view: DashboardView) => void;
  canDecide?: boolean;
  viewTitles: Record<DashboardView, string>;
}) {
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);

  const initials =
    operator?.displayName
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "OP";

  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const hasNotifications = pendingApprovals.length > 0 || quarantinedAgents.length > 0;

  return (
    <header className="topbar relative">
      <div className="flex items-center gap-3 min-w-0">
        <button className="icon-button menu-button" onClick={onMenu} aria-label="Open navigation">
          <Menu />
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <h1 className="text-sm font-semibold tracking-tight text-sentinel-text truncate">
            {viewTitles[view]}
          </h1>
          {!operator ? (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-sentinel-amber/30 bg-sentinel-amber/10 px-2 py-0.5 text-[10px] font-semibold text-sentinel-amber shrink-0">
              <Sparkles className="h-2.5 w-2.5" /> Demo Preview
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-sentinel-lime/30 bg-sentinel-lime/10 px-2 py-0.5 text-[10px] font-semibold text-sentinel-lime shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-sentinel-lime shadow-[0_0_6px_rgba(183,243,74,0.6)]" /> Live Workspace
            </span>
          )}
        </div>
      </div>

      <div className="topbar-actions">
        {operator ? (
          <button
            className="organization-control cursor-pointer"
            onClick={() => onSelectView("settings")}
            title="Manage organization & settings"
          >
            <Building2 className="h-4 w-4 shrink-0 text-sentinel-muted" />
            <span className="truncate max-w-[140px] sm:max-w-[170px] text-xs font-medium">{operator.organizationName}</span>
            <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
          </button>
        ) : null}

        <button
          className="command-control hidden md:flex w-48 lg:w-56 xl:w-64 items-center justify-between cursor-pointer"
          onClick={onOpenCommandPalette}
          aria-label="Search or run command"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="h-3.5 w-3.5 shrink-0 text-sentinel-muted" />
            <span className="truncate whitespace-nowrap text-xs text-sentinel-muted">
              <span className="hidden lg:inline">Search or run command…</span>
              <span className="lg:hidden">Search…</span>
            </span>
          </div>
          <kbd className="shrink-0 font-mono text-[10px] flex items-center gap-0.5 ml-1">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </button>

        <button
          className="icon-button md:hidden"
          onClick={onOpenCommandPalette}
          aria-label="Search or run command"
          title="Search (⌘K)"
        >
          <Search className="h-4 w-4" />
        </button>

        <ThemeToggle />

        <div className="relative">
          <button
            className={`icon-button notification-button ${
              notificationsOpen ? "bg-white/10 text-sentinel-lime" : ""
            }`}
            onClick={onToggleNotifications}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
          >
            <Bell />
            {hasNotifications ? <span /> : null}
          </button>

          <NotificationPopover
            open={notificationsOpen}
            onClose={onToggleNotifications}
            approvals={approvals}
            onDecision={onDecision}
            quarantinedAgents={quarantinedAgents}
            integrityVerified={integrityVerified}
            onSelectView={onSelectView}
            canDecide={canDecide}
          />
        </div>

        {operator ? (
          <div className="relative">
            <button
              className="flex items-center gap-2 rounded-xl border border-sentinel-line/80 bg-sentinel-surface px-1.5 py-1 transition-all hover:border-sentinel-line-strong hover:bg-sentinel-surface-raised cursor-pointer"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              aria-label="Operator profile menu"
              aria-expanded={profileMenuOpen}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sentinel-lime/10 font-mono text-xs font-bold text-sentinel-lime border border-sentinel-lime/30">
                {initials}
              </span>
              <span className="hidden xl:inline text-xs font-medium text-sentinel-text truncate max-w-[100px]">
                {operator.displayName.split(" ")[0]}
              </span>
              <span className="rounded bg-sentinel-canvas/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-sentinel-muted">
                {operator.role}
              </span>
              <ChevronDown className="h-3 w-3 text-sentinel-muted transition-transform duration-150" />
            </button>

            {profileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileMenuOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-2xl border border-sentinel-line bg-sentinel-surface p-2 shadow-2xl backdrop-blur-xl animate-in fade-in-50 zoom-in-95">
                  <div className="border-b border-sentinel-line/60 p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sentinel-lime/10 font-mono text-xs font-bold text-sentinel-lime border border-sentinel-lime/30">
                        {initials}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-sentinel-text">
                          {operator.displayName}
                        </p>
                        <p className="truncate text-[11px] text-sentinel-muted">
                          {operator.email}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px]">
                      <span className="rounded border border-sentinel-line bg-sentinel-canvas px-1.5 py-0.5 uppercase font-medium text-sentinel-muted">
                        {operator.role} Role
                      </span>
                      <span className="font-mono text-sentinel-lime flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-sentinel-lime"></span>
                        Active
                      </span>
                    </div>
                  </div>

                  <div className="py-1 space-y-0.5 text-xs">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sentinel-text hover:bg-sentinel-canvas transition-colors text-left cursor-pointer"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onSelectView("settings");
                      }}
                    >
                      <Building2 className="h-3.5 w-3.5 text-sentinel-muted" />
                      <span>Workspace & Account Settings</span>
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sentinel-text hover:bg-sentinel-canvas transition-colors text-left cursor-pointer"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onChangePassword();
                      }}
                    >
                      <KeyRound className="h-3.5 w-3.5 text-sentinel-muted" />
                      <span>Change Password</span>
                    </button>
                  </div>

                  <div className="border-t border-sentinel-line/60 pt-1">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-red-500 hover:bg-red-500/10 transition-colors text-xs font-medium text-left cursor-pointer"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onLogout();
                      }}
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Log Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="primary-button text-xs py-1.5 px-3.5 flex items-center gap-1.5 shadow-sm cursor-pointer"
            onClick={onOpenConnect}
          >
            <PlugZap className="h-3.5 w-3.5" />
            <span>Connect / Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
}
