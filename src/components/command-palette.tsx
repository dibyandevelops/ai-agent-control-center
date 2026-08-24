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
  agents?: Agent[];
  policies?: Policy[];
}

export function CommandPalette({
  open,
  onClose,
  onSelectView,
  onOpenCreatePolicy,
  onVerifyIntegrity,
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

  const quickNav = useMemo(
    () => [
      { id: "overview", label: "Overview Dashboard", category: "Navigation", icon: LayoutDashboard, action: () => onSelectView("overview") },
      { id: "approvals", label: "Approval Queue & 4-Eyes Governance", category: "Navigation", icon: FileCheck2, action: () => onSelectView("approvals") },
      { id: "policies", label: "Policies & Sandbox Replay", category: "Navigation", icon: Shield, action: () => onSelectView("policies") },
      { id: "agents", label: "AI Agent Inventory & Killswitches", category: "Navigation", icon: Bot, action: () => onSelectView("agents") },
      { id: "audit", label: "Audit Log & Cryptographic Seals", category: "Navigation", icon: FileClock, action: () => onSelectView("audit") },
      { id: "integrations", label: "Integrations & HTTPS Webhooks", category: "Navigation", icon: PlugZap, action: () => onSelectView("integrations") },
      { id: "team", label: "Team & SCIM / SAML Directory", category: "Navigation", icon: UsersRound, action: () => onSelectView("team") },
      { id: "credentials", label: "Agent API Keys & Credentials", category: "Navigation", icon: KeyRound, action: () => onSelectView("credentials") },
    ],
    [onSelectView],
  );

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

    const matchedNav = quickNav.filter((item) => item.label.toLowerCase().includes(q));
    const matchedActions = quickActions.filter((item) => item.label.toLowerCase().includes(q));

    const matchedAgents = agents
      .filter((a) => a.name.toLowerCase().includes(q) || a.owner.toLowerCase().includes(q))
      .slice(0, 5)
      .map((a) => ({
        id: `agent-${a.id}`,
        label: `${a.name} (${a.status}) — Owner: ${a.owner}`,
        category: "AI Agent",
        icon: Bot,
        action: () => onSelectView("agents"),
      }));

    const matchedPolicies = policies
      .filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
      .slice(0, 5)
      .map((p) => ({
        id: `policy-${p.id}`,
        label: `${p.name} [${p.mode}]`,
        category: "Policy",
        icon: Shield,
        action: () => onSelectView("policies"),
      }));

    return [...matchedNav, ...matchedActions, ...matchedAgents, ...matchedPolicies];
  }, [query, quickNav, quickActions, agents, policies, onSelectView]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-start justify-center bg-black/75 p-4 pt-16 sm:pt-24 backdrop-blur-sm"
      role="presentation"
      onMouseDown={() => {
        setQuery("");
        onClose();
      }}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-sentinel-line-strong bg-[#0f141a] shadow-2xl animate-dialog-in"
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-sentinel-line px-4 py-3">
          <Search className="h-4 w-4 text-sentinel-muted" />
          <input
            className="flex-1 bg-transparent px-3 text-sm text-sentinel-text placeholder:text-sentinel-dim outline-none"
            placeholder="Type a command, search agents, or jump to view…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-sentinel-line px-1.5 py-0.5 text-[10px] font-mono text-sentinel-muted">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-sentinel-muted">
              No results found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition hover:bg-white/[0.06] hover:text-sentinel-lime group"
                    onClick={() => {
                      item.action();
                      setQuery("");
                      onClose();
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="h-4 w-4 text-sentinel-muted group-hover:text-sentinel-lime shrink-0" />
                      <span className="truncate text-sentinel-text group-hover:text-white font-medium">
                        {item.label}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-sentinel-dim uppercase tracking-wider shrink-0 ml-2">
                      {item.category}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-sentinel-line bg-[#0c1015] px-4 py-2 text-[11px] text-sentinel-dim flex items-center justify-between">
          <span>Navigate with click or arrow keys</span>
          <span>SentinelOps v0.1.0</span>
        </div>
      </div>
    </div>
  );
}
