"use client";

import {
  Bell,
  Building2,
  ChevronDown,
  Command,
  KeyRound,
  LogOut,
  Menu,
  Search,
} from "lucide-react";
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
      .toUpperCase() || "SO";

  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const hasNotifications = pendingApprovals.length > 0 || quarantinedAgents.length > 0;

  return (
    <header className="topbar relative">
      <button className="icon-button menu-button" onClick={onMenu} aria-label="Open navigation">
        <Menu />
      </button>

      <h1>{viewTitles[view]}</h1>

      <div className="topbar-actions">
        <button
          className="organization-control"
          onClick={() => onSelectView("settings")}
          title="Manage organization & settings"
        >
          <Building2 />
          <span>{operator?.organizationName || "Aperture Labs"}</span>
          <ChevronDown />
        </button>

        <button
          className="command-control"
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

        <button
          className="profile-control"
          onClick={() => onSelectView("settings")}
          disabled={!operator}
          aria-label={operator ? "Operator profile & settings" : "Operator profile"}
        >
          <span className="avatar">{initials}</span>
          <span className="profile-name">
            {operator?.displayName || "SentinelOps Operator"}
            {operator ? (
              <small className="ml-2 capitalize text-sentinel-muted">{operator.role}</small>
            ) : null}
          </span>
          <KeyRound aria-hidden="true" />
        </button>

        {operator ? (
          <button
            className="secondary-button topbar-logout flex items-center gap-1.5"
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}
