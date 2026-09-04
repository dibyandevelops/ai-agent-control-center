"use client";

import {
  Activity,
  BookOpen,
  Bot,
  ClipboardCheck,
  FileClock,
  KeyRound,
  LayoutDashboard,
  PlugZap,
  Settings,
  Shield,
  UsersRound,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import type { DashboardView } from "@/lib/types";

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

export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <span className={small ? "brand-mark brand-mark-small" : "brand-mark"} aria-hidden="true">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 48" width="44" height="48" fill="none">
        <path
          d="M22 2.5 L41.5 12.5 V35.5 L22 45.5 L2.5 35.5 V12.5 Z"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinejoin="round"
        />
        <path
          d="M12 17 L22 11 L32 17 L22 23 L32 29 L22 36 L12 30 L17 27 L22 30 L26 28 L12 20 V17 Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

export function Sidebar({
  view,
  open,
  collapsed,
  pendingCount,
  canManageOperators,
  onSelect,
  onClose,
  onToggleCollapse,
}: {
  view: DashboardView;
  open: boolean;
  collapsed: boolean;
  pendingCount: number;
  canManageOperators: boolean;
  onSelect: (view: DashboardView) => void;
  onClose: () => void;
  onToggleCollapse: () => void;
}) {
  return (
    <>
      {open && <button className="mobile-overlay" onClick={onClose} aria-label="Close navigation" />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}>
        <div className="brand">
          <BrandMark />
          {!collapsed || open ? (
            <span>
              Sentinel<strong>Ops</strong>
            </span>
          ) : null}
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="Close navigation">
            <X />
          </button>
        </div>

        <nav aria-label="Product navigation">
          {navItems
            .filter((item) => !item.adminOnly || canManageOperators)
            .map((item) => {
              const Icon = item.icon;
              const selected = view === item.id;
              return (
                <button
                  key={item.id}
                  className={`nav-item ${selected ? "nav-item-selected" : ""}`}
                  onClick={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                  title={collapsed && !open ? item.label : undefined}
                  aria-current={selected ? "page" : undefined}
                >
                  <Icon />
                  {!collapsed || open ? <span>{item.label}</span> : null}
                  {item.id === "approvals" && pendingCount > 0 && (
                    <span className="nav-count">{pendingCount}</span>
                  )}
                </button>
              );
            })}
        </nav>

        <div className="px-3 pb-2 pt-1 space-y-1.5">
          <Link
            href="/sales-agent"
            className="flex items-center gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs font-medium text-emerald-400 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10"
            title={collapsed && !open ? "Sales Agent Demo" : undefined}
          >
            <Bot className="h-4 w-4 shrink-0 text-emerald-400" />
            {!collapsed || open ? <span>Sales Agent Demo</span> : null}
          </Link>
          <Link
            href="/docs/connecting-agents"
            target="_blank"
            className="flex items-center gap-2.5 rounded-lg border border-sentinel-line/80 bg-sentinel-surface/60 px-3 py-2 text-xs font-medium text-sentinel-muted transition-colors hover:text-sentinel-text hover:border-sentinel-line"
            title={collapsed && !open ? "Agent Connection Docs" : undefined}
          >
            <BookOpen className="h-4 w-4 shrink-0 text-sentinel-lime" />
            {!collapsed || open ? <span>Connection Docs</span> : null}
          </Link>
        </div>

        <div className="sidebar-footer">
          {!collapsed || open ? (
            <div className="system-state">
              <span className="online-dot" />
              <div>
                <span>System status</span>
                <strong>All systems operational</strong>
              </div>
            </div>
          ) : null}
          <button
            className="collapse-control"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
}
