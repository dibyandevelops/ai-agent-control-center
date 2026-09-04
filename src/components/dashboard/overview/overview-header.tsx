"use client";

import {
  Bot,
  ClipboardCheck,
  PlugZap,
  RefreshCw,
  Shield,
  Zap,
} from "lucide-react";
import React from "react";
import type { OperatorIdentity } from "@/lib/types";

export function OverviewHeader({
  operator,
  live,
  isFetching = false,
  onRegister,
  onOpenPolicies,
  onOpenIntegrations,
}: {
  operator: OperatorIdentity | null;
  live: boolean;
  isFetching?: boolean;
  onRegister: () => void;
  onOpenPolicies: () => void;
  onOpenIntegrations: () => void;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sentinel-line/80 bg-gradient-to-r from-sentinel-surface via-sentinel-surface-raised/40 to-sentinel-surface px-3.5 py-2 shadow-sm">
      <div className="flex flex-wrap items-center gap-2.5 min-w-0">
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-sentinel-lime/30 bg-sentinel-lime/10 px-2 py-0.5 font-mono text-[10px] font-bold text-sentinel-lime uppercase tracking-wider">
            {operator?.organizationName || "SentinelOps"}
          </span>
          <h1 className="text-sm font-bold tracking-tight text-sentinel-text truncate">
            {operator ? `Welcome, ${operator.displayName.split(" ")[0]}` : "AI Control Center"}
          </h1>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-xs text-sentinel-muted border-l border-sentinel-line/60 pl-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sentinel-lime opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-sentinel-lime"></span>
          </span>
          <span className="font-mono text-sentinel-lime font-medium text-[11px]">Zero-Trust Enforced</span>
          <span className="text-sentinel-line">•</span>
          <span className="font-mono text-[11px]">&lt; 0.8ms SLA</span>
          <span className="text-sentinel-line">•</span>
          <span className="font-mono text-[11px]">SHA-256 Chain</span>
          {isFetching && (
            <>
              <span className="text-sentinel-line">•</span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-sentinel-lime">
                <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                <span>Sync</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 max-sm:grid max-sm:grid-cols-2 max-sm:w-full">
        <button
          type="button"
          onClick={onRegister}
          className="primary-button text-xs py-1.5 px-3 flex items-center justify-center gap-1.5 shadow-sm shadow-sentinel-lime/20 cursor-pointer"
        >
          <Bot className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Register Agent</span>
        </button>
        <button
          type="button"
          onClick={onOpenPolicies}
          className="secondary-button text-xs py-1.5 px-3 flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Shield className="h-3.5 w-3.5 shrink-0 text-sentinel-lime" />
          <span className="truncate">Policies</span>
        </button>
        <button
          type="button"
          onClick={onOpenIntegrations}
          className="secondary-button text-xs py-1.5 px-3 hidden sm:flex items-center gap-1.5 cursor-pointer"
        >
          <PlugZap className="h-3.5 w-3.5 shrink-0 text-sentinel-muted" />
          <span>Integrations</span>
        </button>
      </div>
    </header>
  );
}
