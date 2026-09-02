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
      <div className="flex items-center gap-3">
        <button className="icon-button menu-button" onClick={onMenu} aria-label="Open navigation">
          <Menu />
        </button>

        <div className="flex items-center gap-2.5">
          <h1 className="text-sm font-semibold tracking-tight text-sentinel-text">
            {viewTitles[view]}
          </h1>
          {!operator ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-sentinel-amber/30 bg-sentinel-amber/10 px-2 py-0.5 text-[10px] font-semibold text-sentinel-amber">
              <Sparkles className="h-2.5 w-2.5" /> Demo Preview
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-sentinel-lime/30 bg-sentinel-lime/10 px-2 py-0.5 text-[10px] font-semibold text-sentinel-lime">
              <span className="h-1.5 w-1.5 rounded-full bg-sentinel-lime shadow-[0_0_6px_rgba(183,243,74,0.6)]" /> Live Workspace
            </span>
          )}
        </div>
      </div>

      <div className="topbar-actions">
        {operator ? (
          <button
            className="organization-control"
            onClick={() => onSelectView("settings")}
            title="Manage organization & settings"
          >
            <Building2 />
            <span className="truncate max-w-[130px]">{operator.organizationName}</span>
            <ChevronDown className="h-3 w-3 opacity-60" />
          </button>
        ) : null}

        <button
          className="command-control hidden md:flex"
          onClick={onOpenCommandPalette}
          aria-label="Search or run command"
        >
          <Search />
          <span>Search or run command…</span>
          <kbd>
            <Command />K
          </kbd>
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
          <>
            <button
              className="profile-control"
              onClick={() => onSelectView("settings")}
              aria-label="Operator profile & settings"
            >
              <span className="avatar">{initials}</span>
              <span className="profile-name">
                {operator.displayName}
                <small className="ml-2 capitalize text-sentinel-muted">{operator.role}</small>
              </span>
              <KeyRound aria-hidden="true" className="h-3.5 w-3.5 text-sentinel-muted" />
            </button>

            <button
              className="secondary-button topbar-logout flex items-center gap-1.5"
              onClick={onLogout}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            className="primary-button text-xs py-1.5 px-3.5 flex items-center gap-1.5 shadow-sm"
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
