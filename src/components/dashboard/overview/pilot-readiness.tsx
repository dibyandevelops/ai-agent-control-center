"use client";

import {
  Check,
  ClipboardCheck,
  Eye,
  EyeOff,
} from "lucide-react";
import React, { useEffect, useState } from "react";
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
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("sentinelops_hide_launch_checklist");
      if (saved === "true") {
        setIsDismissed(true);
      }
    } catch {
      // Ignore localStorage access errors
    }
  }, []);

  const toggleDismissed = () => {
    const next = !isDismissed;
    setIsDismissed(next);
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

  if (mounted && isDismissed) {
    return (
      <div className="mb-5 flex items-center justify-between rounded-xl border border-sentinel-line/80 bg-sentinel-surface/60 px-4 py-2.5 text-xs text-sentinel-muted shadow-sm transition-all duration-200">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-sentinel-lime/10 text-sentinel-lime">
            <ClipboardCheck className="h-3.5 w-3.5" />
          </span>
          <span className="font-medium text-sentinel-text">Workspace launch checklist</span>
          <span className="rounded-full border border-sentinel-lime/30 bg-sentinel-lime/10 px-2 py-0.5 text-[10px] font-semibold text-sentinel-lime">
            {completeCount}/6 complete
          </span>
        </div>
        <button
          type="button"
          onClick={toggleDismissed}
          className="flex items-center gap-1.5 rounded-lg border border-sentinel-line bg-sentinel-canvas/70 px-2.5 py-1 text-xs font-semibold text-sentinel-lime transition-colors hover:border-sentinel-lime/40 hover:bg-sentinel-lime/10"
        >
          <Eye className="h-3.5 w-3.5" />
          Show checklist
        </button>
      </div>
    );
  }

  return (
    <section className="mb-5 rounded-app border border-sentinel-lime/25 bg-sentinel-lime/5 p-4 shadow-app-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-sentinel-text">Workspace launch checklist</p>
            <span className="rounded-full border border-sentinel-lime/30 bg-sentinel-lime/10 px-2.5 py-0.5 text-[10px] font-semibold text-sentinel-lime">
              {completeCount}/6 complete
            </span>
          </div>
          <p className="mt-1 text-xs text-sentinel-muted">Complete this path before connecting a production-impacting agent.</p>
        </div>
        <button
          type="button"
          onClick={toggleDismissed}
          className="flex items-center gap-1.5 rounded-lg border border-sentinel-line bg-sentinel-surface/80 px-2.5 py-1 text-xs font-medium text-sentinel-muted transition-colors hover:border-sentinel-line hover:text-sentinel-text"
          title="Hide workspace launch checklist"
        >
          <EyeOff className="h-3.5 w-3.5" />
          <span>Hide checklist</span>
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-xl border border-sentinel-line bg-sentinel-surface/70 p-3">
            <div className="flex items-start gap-2">
              <span
                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${
                  step.complete
                    ? "border-sentinel-lime/40 bg-sentinel-lime/10 text-sentinel-lime"
                    : "border-sentinel-line text-sentinel-muted"
                }`}
              >
                {step.complete ? <Check className="h-3.5 w-3.5" /> : <span className="text-[10px]">{index + 1}</span>}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sentinel-text">{step.title}</p>
                <p className="mt-1 text-[11px] leading-5 text-sentinel-muted">{step.detail}</p>
              </div>
            </div>
            {step.complete ? (
              <p className="mt-3 text-[11px] font-medium text-sentinel-lime">Complete</p>
            ) : (
              <button className="mt-3 text-xs font-semibold text-sentinel-lime" onClick={step.action}>
                {step.actionLabel}
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
