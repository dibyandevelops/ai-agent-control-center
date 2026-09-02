"use client";

import {
  Bot,
  FileCheck2,
  FileClock,
  KeyRound,
  LayoutDashboard,
  PlugZap,
  Plus,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import type { Agent, DashboardView, Policy } from "@/lib/types";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectView: (view: DashboardView) => void;
  onOpenCreatePolicy?: () => void;
  onVerifyIntegrity?: () => void;
  canManageOperators?: boolean;
  agents?: Agent[];
  policies?: Policy[];
}

export function CommandPalette({
  open,
  onClose,
  onSelectView,
  onOpenCreatePolicy,
  onVerifyIntegrity,
  canManageOperators = false,
  agents = [],
  policies = [],
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) onClose();
      }
      if (event.key === "Escape" && open) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const quickNav = useMemo(() => {
    const items = [
      {
        id: "overview",
        label: "Overview Dashboard",
        category: "Navigation",
        icon: LayoutDashboard,
        action: () => onSelectView("overview"),
      },
      {
        id: "approvals",
        label: "Approval Queue & 4-Eyes Governance",
        category: "Navigation",
        icon: FileCheck2,
        action: () => onSelectView("approvals"),
      },
      {
        id: "policies",
        label: "Policies & Sandbox Replay",
        category: "Navigation",
        icon: Shield,
        action: () => onSelectView("policies"),
      },
      {
        id: "agents",
        label: "AI Agent Inventory & Killswitches",
        category: "Navigation",
        icon: Bot,
        action: () => onSelectView("agents"),
      },
      {
        id: "audit",
        label: "Audit Log & Cryptographic Seals",
        category: "Navigation",
        icon: FileClock,
        action: () => onSelectView("audit"),
      },
      {
        id: "integrations",
        label: "Integrations & HTTPS Webhooks",
        category: "Navigation",
        icon: PlugZap,
        action: () => onSelectView("integrations"),
      },
      ...(canManageOperators
        ? [
            {
              id: "team",
              label: "Team & SCIM / SAML Directory",
              category: "Navigation",
              icon: UsersRound,
              action: () => onSelectView("team"),
            },
            {
              id: "credentials",
              label: "Agent API Keys & Credentials",
              category: "Navigation",
              icon: KeyRound,
              action: () => onSelectView("credentials"),
            },
          ]
        : []),
      {
        id: "settings",
        label: "Workspace & Profile Settings",
        category: "Navigation",
        icon: Settings,
        action: () => onSelectView("settings"),
      },
    ];
    return items;
  }, [onSelectView, canManageOperators]);

  const quickActions = useMemo(
    () => [
      {
        id: "create-policy",
        label: "Create new enforcement policy",
        category: "Action",
        icon: Plus,
        action: () => {
          onSelectView("policies");
          if (onOpenCreatePolicy) onOpenCreatePolicy();
        },
      },
      {
        id: "verify-audit",
        label: "Verify cryptographic audit chain integrity",
        category: "Action",
        icon: ShieldCheck,
        action: () => {
          onSelectView("audit");
          if (onVerifyIntegrity) onVerifyIntegrity();
        },
      },
    ],
    [onSelectView, onOpenCreatePolicy, onVerifyIntegrity],
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...quickNav, ...quickActions];
    }
    const navAndActions = [...quickNav, ...quickActions].filter((item) =>
      item.label.toLowerCase().includes(q),
    );

    const matchingAgents = agents
      .filter(
        (agent) =>
          agent.name.toLowerCase().includes(q) ||
          agent.team.toLowerCase().includes(q) ||
          agent.owner.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .map((agent) => ({
        id: `agent-${agent.id}`,
        label: `${agent.name} (${agent.team})`,
        category: "Agent",
        icon: Bot,
        action: () => onSelectView("agents"),
      }));

    const matchingPolicies = policies
      .filter((policy) => policy.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((policy) => ({
        id: `policy-${policy.id}`,
        label: `Policy: ${policy.name}`,
        category: "Policy",
        icon: Shield,
        action: () => onSelectView("policies"),
      }));

    return [...navAndActions, ...matchingAgents, ...matchingPolicies];
  }, [query, quickNav, quickActions, agents, policies, onSelectView]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-sentinel-line-strong bg-sentinel-surface shadow-2xl animate-dialog-in"
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        <div className="flex items-center border-b border-sentinel-line px-4 py-3">
          <Search className="mr-3 h-4 w-4 text-sentinel-muted" />
          <input
            type="text"
            className="w-full bg-transparent text-sm text-sentinel-text placeholder-sentinel-dim outline-none"
            placeholder="Search views, agents, policies, actions… (ESC to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="rounded border border-sentinel-line bg-sentinel-canvas px-1.5 py-0.5 text-[10px] font-mono text-sentinel-muted">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-sentinel-muted">
              No matching commands or resources found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-sentinel-text transition hover:bg-sentinel-raised hover:text-sentinel-lime"
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 text-sentinel-muted shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    <span className="rounded-md border border-sentinel-line bg-sentinel-canvas/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-sentinel-dim shrink-0">
                      {item.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-sentinel-line bg-sentinel-canvas/40 px-4 py-2 text-[11px] text-sentinel-muted flex items-center justify-between">
          <span>ProTip: Press <kbd className="font-mono text-sentinel-text">?</kbd> for full shortcut map</span>
          <span className="font-mono">SentinelOps v1.2</span>
        </div>
      </div>
    </div>
  );
}
