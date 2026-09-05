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
import type { Agent, Approval, DashboardView, Policy } from "@/lib/types";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelectView: (view: DashboardView) => void;
  onOpenCreatePolicy?: () => void;
  onVerifyIntegrity?: () => void;
  onOpenRegisterAgent?: () => void;
  onOpenConnect?: () => void;
  canManageOperators?: boolean;
  agents?: Agent[];
  policies?: Policy[];
  approvals?: Approval[];
}

export function CommandPalette({
  open,
  onClose,
  onSelectView,
  onOpenCreatePolicy,
  onVerifyIntegrity,
  onOpenRegisterAgent,
  onOpenConnect,
  canManageOperators = false,
  agents = [],
  policies = [],
  approvals = [],
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = React.useRef<HTMLDivElement | null>(null);

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
      ...(onOpenRegisterAgent
        ? [
            {
              id: "register-agent",
              label: "Register new AI agent",
              category: "Action",
              icon: Bot,
              action: onOpenRegisterAgent,
            },
          ]
        : []),
      ...(onOpenConnect
        ? [
            {
              id: "connect-session",
              label: "Connect live telemetry session",
              category: "Action",
              icon: PlugZap,
              action: onOpenConnect,
            },
          ]
        : []),
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
    [onSelectView, onOpenCreatePolicy, onVerifyIntegrity, onOpenRegisterAgent, onOpenConnect],
  );

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...quickNav, ...quickActions];
    }
    const navAndActions = [...quickNav, ...quickActions].filter((item) =>
      item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q),
    );

    const matchingApprovals = approvals
      .filter(
        (approval) =>
          approval.agentName.toLowerCase().includes(q) ||
          approval.request.toLowerCase().includes(q) ||
          approval.resource.toLowerCase().includes(q),
      )
      .slice(0, 4)
      .map((approval) => ({
        id: `approval-${approval.id}`,
        label: `Approval Gate: ${approval.agentName} (${approval.request})`,
        category: "Approval",
        icon: FileCheck2,
        action: () => onSelectView("approvals"),
      }));

    const matchingAgents = agents
      .filter(
        (agent) =>
          agent.name.toLowerCase().includes(q) ||
          agent.team.toLowerCase().includes(q) ||
          agent.owner.toLowerCase().includes(q) ||
          agent.status.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .map((agent) => ({
        id: `agent-${agent.id}`,
        label: `${agent.name} • ${agent.team} (${agent.status})`,
        category: "Agent",
        icon: Bot,
        action: () => onSelectView("agents"),
      }));

    const matchingPolicies = policies
      .filter((policy) => policy.name.toLowerCase().includes(q) || policy.description?.toLowerCase().includes(q))
      .slice(0, 5)
      .map((policy) => ({
        id: `policy-${policy.id}`,
        label: `Policy: ${policy.name}`,
        category: "Policy",
        icon: Shield,
        action: () => onSelectView("policies"),
      }));

    return [...matchingApprovals, ...navAndActions, ...matchingAgents, ...matchingPolicies];
  }, [query, quickNav, quickActions, agents, policies, approvals, onSelectView]);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }

  const [prevQuery, setPrevQuery] = useState(query);
  if (prevQuery !== query) {
    setPrevQuery(query);
    setSelectedIndex(0);
  }

  useEffect(() => {
    if (!open) return;
    const activeEl = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, open]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) onClose();
      }
      if (!open) return;

      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length ? (prev + 1) % filteredItems.length : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, filteredItems, selectedIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-16 max-sm:p-2 max-sm:pt-10 bg-black/60 backdrop-blur-sm animate-fade-in"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex w-full max-w-lg max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-sentinel-line-strong bg-sentinel-surface shadow-2xl animate-dialog-in"
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
      >
        <div className="flex items-center border-b border-sentinel-line px-4 py-3">
          <Search className="mr-3 h-4 w-4 text-sentinel-muted" />
          <input
            type="text"
            className="w-full bg-transparent text-sm text-sentinel-text placeholder:text-sentinel-muted outline-none"
            placeholder="Search views, agents, approvals, policies… (ESC to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="rounded border border-sentinel-line bg-sentinel-canvas px-1.5 py-0.5 text-[10px] font-mono text-sentinel-muted">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="p-6 text-center text-xs text-sentinel-muted">
              No matching commands or resources found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, index) => {
                const Icon = item.icon;
                const isSelected = index === selectedIndex;
                return (
                  <button
                    key={item.id}
                    data-index={index}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition cursor-pointer ${
                      isSelected
                        ? "bg-sentinel-surface-raised border border-sentinel-lime/40 text-sentinel-lime shadow-sm"
                        : "text-sentinel-text hover:bg-sentinel-surface-raised hover:text-sentinel-lime border border-transparent"
                    }`}
                    onMouseEnter={() => setSelectedIndex(index)}
                    onClick={() => {
                      item.action();
                      onClose();
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`h-4 w-4 shrink-0 ${isSelected ? "text-sentinel-lime" : "text-sentinel-muted"}`} />
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
          <div className="flex items-center gap-2">
            <span>Navigate <kbd className="font-mono text-[10px] px-1 bg-sentinel-surface border rounded">↑</kbd> <kbd className="font-mono text-[10px] px-1 bg-sentinel-surface border rounded">↓</kbd></span>
            <span>Select <kbd className="font-mono text-[10px] px-1 bg-sentinel-surface border rounded">↵</kbd></span>
          </div>
          <span className="font-mono text-[10px]">SentinelOps Command Center</span>
        </div>
      </div>
    </div>
  );
}
