"use client";

import {
  Bot,
  ClipboardCheck,
  PlugZap,
  Shield,
  Zap,
} from "lucide-react";
import React from "react";
import type { OperatorIdentity } from "@/lib/types";

export function OverviewHeader({
  operator,
  live,
  onRegister,
  onOpenPolicies,
  onOpenIntegrations,
}: {
  operator: OperatorIdentity | null;
  live: boolean;
  onRegister: () => void;
  onOpenPolicies: () => void;
  onOpenIntegrations: () => void;
}) {
  return (
    <header className="mb-5 space-y-3">
      {/* Executive Command Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sentinel-line/90 bg-gradient-to-r from-sentinel-surface via-sentinel-surface-raised/40 to-sentinel-surface p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-sentinel-lime/30 bg-sentinel-lime/10 px-2 py-0.5 font-mono text-[10px] font-bold text-sentinel-lime uppercase tracking-wider">
              {operator?.organizationName || "SentinelOps Defense"}
            </span>
            <span className="rounded-md border border-sentinel-line bg-sentinel-canvas/80 px-2 py-0.5 font-mono text-[10px] text-sentinel-muted uppercase">
              {operator?.role || "Admin"} Operator
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-sentinel-text">
            {operator ? `Welcome back, ${operator.displayName}` : "SentinelOps AI Control Center"}
          </h1>
          <p className="text-xs text-sentinel-muted">
            {live
              ? "Autonomous AI workforce governance, zero-trust policy enforcement, and audit ledger."
              : "Explore the AI governance control center in demo mode."}
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onRegister}
            className="primary-button flex items-center gap-2 shadow-sm shadow-sentinel-lime/20"
          >
            <Bot className="h-4 w-4" />
            <span>Register Agent</span>
          </button>
          <button
            type="button"
            onClick={onOpenPolicies}
            className="secondary-button flex items-center gap-2"
          >
            <Shield className="h-4 w-4 text-sentinel-lime" />
            <span>Policies</span>
          </button>
          <button
            type="button"
            onClick={onOpenIntegrations}
            className="secondary-button flex items-center gap-2"
          >
            <PlugZap className="h-4 w-4 text-sentinel-muted" />
            <span>Integrations</span>
          </button>
        </div>
      </div>

      {/* System Health Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sentinel-line/80 bg-sentinel-surface/70 px-4 py-2.5 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sentinel-lime opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sentinel-lime"></span>
            </span>
            <span className="font-semibold text-sentinel-text">Policy Engine:</span>
            <span className="font-mono text-sentinel-lime font-semibold">ACTIVE (Zero-Trust)</span>
          </div>
          <span className="hidden text-sentinel-line sm:inline">•</span>
          <div className="flex items-center gap-1.5 text-sentinel-muted">
            <Zap className="h-3.5 w-3.5 text-sentinel-lime" />
            <span>Evaluation SLA:</span>
            <span className="font-mono text-sentinel-text font-medium">&lt; 0.8ms</span>
          </div>
          <span className="hidden text-sentinel-line md:inline">•</span>
          <div className="flex items-center gap-1.5 text-sentinel-muted">
            <Shield className="h-3.5 w-3.5 text-sentinel-accent" />
            <span>Audit Chain:</span>
            <span className="font-mono text-sentinel-text font-medium">SHA-256 Tamper-Proof</span>
          </div>
          <span className="hidden text-sentinel-line lg:inline">•</span>
          <div className="flex items-center gap-1.5 text-sentinel-muted">
            <ClipboardCheck className="h-3.5 w-3.5 text-sentinel-lime" />
            <span>Human Gateway:</span>
            <span className="font-mono text-sentinel-text font-medium">Enforcing Sign-Offs</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-sentinel-line bg-sentinel-canvas/80 px-2.5 py-0.5 font-mono text-[11px] text-sentinel-muted">
            {live ? "Live Production Workspace" : "Interactive Demo Preview"}
          </span>
        </div>
      </div>
    </header>
  );
}
