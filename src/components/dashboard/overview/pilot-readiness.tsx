"use client";

import {
  Check,
  ChevronDown,
  ClipboardCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import React, { useState, useSyncExternalStore } from "react";
import type { Agent, AuditEvent } from "@/lib/types";

export function PilotReadiness({
  agents,
  audit,
  policyDecisions,
  onRegister,
  onOpenCredentials,
  onOpenIntegrations,
  onOpenPolicies,
}: {
  agents: Agent[];
  audit: AuditEvent[];
  policyDecisions: number;
  onRegister: () => void;
  onOpenCredentials: () => void;
  onOpenIntegrations: () => void;
  onOpenPolicies: () => void;
}) {
  const [localDismissed, setLocalDismissed] = useState<boolean | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const isStoredDismissed = useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      return () => window.removeEventListener("storage", onStoreChange);
    },
    () => {
      try {
        return localStorage.getItem("sentinelops_hide_launch_checklist") === "true";
      } catch {
        return false;
      }
    },
    () => false,
  );

  const isDismissed = localDismissed !== null ? localDismissed : isStoredDismissed;

  const toggleDismissed = () => {
    const next = !isDismissed;
    setLocalDismissed(next);
    try {
      localStorage.setItem("sentinelops_hide_launch_checklist", String(next));
    } catch {
      // Ignore localStorage write errors
    }
  };

  const agentRegistered = agents.length > 0;
  const agentExercised = agents.some((agent) => agent.actions > 0);
  const mfaProtected = audit.some((event) => /mfa\.(enrolled|verified)/.test(event.action));
  const githubConnected = audit.some((event) => event.action === "github.app_installation_synced");
  const steps = [
    {
      complete: mfaProtected,
      title: "Secure your workspace",
      detail: "Use MFA and keep the first administrator account protected.",
      action: onOpenCredentials,
      actionLabel: "Open credentials",
    },
    {
      complete: githubConnected,
      title: "Connect GitHub",
      detail: "Install the GitHub App for only the repositories this organization governs.",
      action: onOpenIntegrations,
      actionLabel: "Open integrations",
    },
    {
      complete: agentRegistered,
      title: "Register an owned agent",
      detail: "Assign an accountable owner and keep permissions locked by default.",
      action: onRegister,
      actionLabel: "Register agent",
    },
    {
      complete: agentExercised,
      title: "Create and exercise a credential",
      detail: "Run the low-risk connection check before a consequential action.",
      action: onOpenCredentials,
      actionLabel: "Open credentials",
    },
    {
      complete: policyDecisions > 0,
      title: "Verify a policy decision",
      detail: "Send the first governed evaluation and inspect its audit evidence.",
      action: onOpenPolicies,
      actionLabel: "Review policies",
    },
    {
      complete: policyDecisions > 0,
      title: "Review the first action",
      detail: "Confirm the recorded decision and tamper-evident evidence in the audit log.",
      action: onOpenCredentials,
      actionLabel: "View quickstart",
    },
  ];
  const completeCount = steps.filter((step) => step.complete).length;

  if (isDismissed) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-sentinel-line/80 bg-sentinel-surface/60 px-3 py-1.5 text-xs text-sentinel-muted shadow-sm transition-all duration-200">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-sentinel-lime/10 text-sentinel-lime">
            <ClipboardCheck className="h-3 w-3" />
          </span>
          <span className="font-medium text-sentinel-text text-[11px]">Workspace launch checklist</span>
          <span className="rounded-full border border-sentinel-lime/30 bg-sentinel-lime/10 px-1.5 py-0.2 text-[9px] font-semibold text-sentinel-lime">
            {completeCount}/6
          </span>
        </div>
        <button
          type="button"
          onClick={toggleDismissed}
          className="flex items-center gap-1 rounded-md border border-sentinel-line bg-sentinel-canvas/70 px-2 py-0.5 text-[11px] font-semibold text-sentinel-lime transition-colors hover:border-sentinel-lime/40 hover:bg-sentinel-lime/10 cursor-pointer"
        >
          <Eye className="h-3 w-3" />
          Show checklist
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-sentinel-line/80 bg-sentinel-surface/70 px-3 py-1.5 text-xs shadow-sm transition-all">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-sentinel-lime/10 text-sentinel-lime">
            <ClipboardCheck className="h-3 w-3" />
          </span>
          <span className="font-semibold text-sentinel-text text-xs truncate">Launch Checklist</span>
          <span className="rounded-full border border-sentinel-lime/30 bg-sentinel-lime/10 px-2 py-0.2 text-[10px] font-semibold text-sentinel-lime shrink-0">
            {completeCount}/6 complete
          </span>
          <span className="hidden md:inline text-[11px] text-sentinel-muted truncate">
            Baseline zero-trust configuration
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="flex items-center gap-1 rounded-md border border-sentinel-line bg-sentinel-canvas px-2 py-0.5 text-[11px] font-medium text-sentinel-text hover:border-sentinel-lime/40 transition-colors cursor-pointer"
          >
            <span>{isExpanded ? "Hide tasks" : "View tasks"}</span>
            <ChevronDown className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          </button>
          <button
            type="button"
            onClick={toggleDismissed}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-sentinel-muted hover:text-sentinel-text transition-colors cursor-pointer"
            title="Hide launch checklist"
          >
            <EyeOff className="h-3 w-3" />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-2.5 pt-2.5 border-t border-sentinel-line/50 grid gap-2 md:grid-cols-2 xl:grid-cols-3 animate-in fade-in-50">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-lg border border-sentinel-line bg-sentinel-canvas/60 p-2.5">
              <div className="flex items-start gap-2">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${
                    step.complete
                      ? "border-sentinel-lime/40 bg-sentinel-lime/10 text-sentinel-lime"
                      : "border-sentinel-line text-sentinel-muted"
                  }`}
                >
                  {step.complete ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-sentinel-text">{step.title}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-sentinel-muted">{step.detail}</p>
                </div>
              </div>
              {step.complete ? (
                <p className="mt-1.5 text-[10px] font-medium text-sentinel-lime">Complete</p>
              ) : (
                <button className="mt-1.5 text-[11px] font-semibold text-sentinel-lime hover:underline cursor-pointer" onClick={step.action}>
                  {step.actionLabel}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
