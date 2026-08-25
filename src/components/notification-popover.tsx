"use client";

import {
  Bell,
  Check,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  LoaderCircle,
  ShieldAlert,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import React, { useState } from "react";
import type { Approval, Agent, DashboardView } from "@/lib/types";

export interface NotificationPopoverProps {
  open: boolean;
  onClose: () => void;
  approvals?: Approval[];
  onDecision?: (approval: Approval, decision: "approved" | "denied") => Promise<void>;
  quarantinedAgents?: Agent[];
  integrityVerified: boolean;
  onSelectView: (view: DashboardView) => void;
  canDecide?: boolean;
}

type NotificationTab = "approvals" | "alerts";

export function NotificationPopover({
  open,
  onClose,
  approvals = [],
  onDecision,
  quarantinedAgents = [],
  integrityVerified,
  onSelectView,
  canDecide = true,
}: NotificationPopoverProps) {
  const [activeTab, setActiveTab] = useState<NotificationTab>("approvals");
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!open) return null;

  const pendingApprovals = approvals.filter((a) => a.status === "pending");
  const totalPending = pendingApprovals.length + quarantinedAgents.length;

  async function handleInlineDecision(approval: Approval, decision: "approved" | "denied") {
    if (!onDecision || processingId) return;
    setProcessingId(approval.id);
    try {
      await onDecision(approval, decision);
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[110] bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
        role="presentation"
      />
      <div
        className="absolute right-0 top-12 z-[120] w-[92vw] sm:w-[420px] max-w-[440px] rounded-2xl border border-sentinel-border bg-sentinel-surface shadow-2xl animate-dialog-in overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-center-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sentinel-border bg-sentinel-surface px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-lg border border-sentinel-border bg-sentinel-accent-soft text-sentinel-accent">
              <Bell className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 id="notification-center-title" className="text-xs font-bold text-sentinel-text">
                Control Plane Feed
              </h3>
              <span className="text-[10px] text-sentinel-muted">
                {totalPending > 0 ? `${totalPending} items require attention` : "All systems normal"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              className="grid h-6 w-6 place-items-center rounded-md text-sentinel-muted hover:bg-sentinel-surface-raised hover:text-sentinel-text transition"
              onClick={onClose}
              aria-label="Close notifications"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-sentinel-border bg-sentinel-surface-raised/30 px-3 pt-1">
          <button
            type="button"
            onClick={() => setActiveTab("approvals")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
              activeTab === "approvals"
                ? "border-sentinel-accent text-sentinel-accent"
                : "border-transparent text-sentinel-muted hover:text-sentinel-text"
            }`}
          >
            <FileCheck2 className="h-3.5 w-3.5" />
            <span>Pending Approvals</span>
            {pendingApprovals.length > 0 ? (
              <span className="ml-1 rounded-full bg-sentinel-amber px-1.5 py-0.2 font-mono text-[9px] font-bold text-black">
                {pendingApprovals.length}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition ${
              activeTab === "alerts"
                ? "border-sentinel-accent text-sentinel-accent"
                : "border-transparent text-sentinel-muted hover:text-sentinel-text"
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>System Alerts</span>
            {quarantinedAgents.length > 0 ? (
              <span className="ml-1 rounded-full bg-sentinel-danger px-1.5 py-0.2 font-mono text-[9px] font-bold text-white">
                {quarantinedAgents.length}
              </span>
            ) : null}
          </button>
        </div>

        {/* Tab Content */}
        <div className="max-h-[360px] overflow-y-auto p-3 space-y-2.5">
          {activeTab === "approvals" && (
            <>
              {pendingApprovals.length === 0 ? (
                <div className="py-8 text-center text-xs text-sentinel-muted space-y-1.5">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-sentinel-success" />
                  <strong className="block text-sentinel-text">Queue is clear</strong>
                  <p className="text-[11px]">All agent actions have been evaluated or approved.</p>
                </div>
              ) : (
                pendingApprovals.map((approval) => (
                  <div
                    key={approval.id}
                    className="rounded-xl border border-sentinel-border bg-sentinel-canvas/60 p-3 text-xs space-y-2.5 transition hover:border-sentinel-border-strong"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              approval.risk === "high"
                                ? "bg-sentinel-danger"
                                : approval.risk === "medium"
                                  ? "bg-sentinel-amber"
                                  : "bg-sentinel-accent"
                            }`}
                          />
                          <strong className="truncate text-sentinel-text font-semibold text-xs">
                            {approval.request}
                          </strong>
                        </div>
                        <p className="mt-0.5 text-[11px] text-sentinel-muted truncate">
                          {approval.agentName} • {approval.resource}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] text-sentinel-muted">
                        {approval.requestedAt}
                      </span>
                    </div>

                    <div className="rounded-lg border border-sentinel-border/50 bg-sentinel-surface p-2 text-[10px] text-sentinel-muted font-mono truncate">
                      Context: <span className="text-sentinel-text">{approval.context}</span>
                    </div>

                    {/* Inline Fast Approval Actions */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-sentinel-danger/40 bg-sentinel-danger-soft px-2.5 text-[10px] font-bold text-sentinel-danger transition hover:bg-sentinel-danger/20 disabled:opacity-50"
                        disabled={!canDecide || Boolean(processingId)}
                        onClick={() => handleInlineDecision(approval, "denied")}
                      >
                        {processingId === approval.id ? (
                          <LoaderCircle className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                        Deny
                      </button>
                      <button
                        type="button"
                        className="inline-flex h-7 items-center gap-1 rounded-lg border border-sentinel-success/40 bg-sentinel-success-soft px-2.5 text-[10px] font-bold text-sentinel-success transition hover:bg-sentinel-success/20 disabled:opacity-50"
                        disabled={!canDecide || Boolean(processingId)}
                        onClick={() => handleInlineDecision(approval, "approved")}
                      >
                        {processingId === approval.id ? (
                          <LoaderCircle className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Authorize
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === "alerts" && (
            <div className="space-y-2">
              {quarantinedAgents.length > 0 && (
                <div
                  className="cursor-pointer rounded-xl border border-sentinel-danger/40 bg-sentinel-danger-soft p-3 text-xs space-y-1 transition hover:bg-sentinel-danger/15"
                  onClick={() => {
                    onSelectView("agents");
                    onClose();
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-sentinel-danger font-bold">
                      <ShieldAlert className="h-4 w-4" />
                      <span>{quarantinedAgents.length} Emergency Killswitch Active</span>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-sentinel-danger" />
                  </div>
                  <p className="text-[11px] text-sentinel-muted">
                    Execution authority is blocked for {quarantinedAgents.map((a) => a.name).join(", ")}.
                  </p>
                </div>
              )}

              <div
                className="cursor-pointer rounded-xl border border-sentinel-border bg-sentinel-canvas/60 p-3 text-xs space-y-1 transition hover:bg-sentinel-surface-raised"
                onClick={() => {
                  onSelectView("audit");
                  onClose();
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-sentinel-text">
                    <ShieldCheck className="h-4 w-4 text-sentinel-success" />
                    <span>Cryptographic Hash Chain</span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-sentinel-muted" />
                </div>
                <p className="text-[11px] text-sentinel-muted">
                  {integrityVerified
                    ? "All cryptographic tamper-evident blocks are valid."
                    : "Run periodic verification in Audit."}
                </p>
              </div>

              <div
                className="cursor-pointer rounded-xl border border-sentinel-border bg-sentinel-canvas/60 p-3 text-xs space-y-1 transition hover:bg-sentinel-surface-raised"
                onClick={() => {
                  onSelectView("policies");
                  onClose();
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold text-sentinel-text">
                    <Zap className="h-4 w-4 text-sentinel-accent" />
                    <span>Sandbox Replay Engine</span>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 text-sentinel-muted" />
                </div>
                <p className="text-[11px] text-sentinel-muted">
                  Dry-run test cases and candidate policies against recent action logs.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-sentinel-border bg-sentinel-surface-raised/40 px-4 py-2.5 flex items-center justify-between text-[11px]">
          <button
            type="button"
            className="text-sentinel-accent font-semibold hover:underline"
            onClick={() => {
              onSelectView("approvals");
              onClose();
            }}
          >
            Open Approvals Queue →
          </button>
          <span className="font-mono text-[10px] text-sentinel-muted">
            SentinelOps Sentinel
          </span>
        </div>
      </div>
    </>
  );
}
