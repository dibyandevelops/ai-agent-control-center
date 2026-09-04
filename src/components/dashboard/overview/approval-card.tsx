"use client";

import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  GitBranch,
  LoaderCircle,
  User,
  XCircle,
} from "lucide-react";
import React, { useState } from "react";
import type { Approval } from "@/lib/types";
import { displayTime, Risk } from "../common/ui-helpers";

export function ApprovalCard({
  approval,
  onDecision,
  canDecide,
  compact = false,
  detailed = false,
}: {
  approval: Approval;
  onDecision: (approval: Approval, decision: "approved" | "denied") => Promise<void>;
  canDecide: boolean;
  compact?: boolean;
  detailed?: boolean;
}) {
  const [pendingDecision, setPendingDecision] = useState<"approved" | "denied" | null>(null);
  const [expanded, setExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  async function submitDecision(decision: "approved" | "denied") {
    if (pendingDecision) return;
    setPendingDecision(decision);
    try {
      await onDecision(approval, decision);
    } finally {
      setPendingDecision(null);
    }
  }

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard?.writeText(approval.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write error
    }
  };

  const isHighRisk = approval.risk === "high";

  // Optimized compact rendering for sidebars and 320px rails
  if (compact) {
    return (
      <article
        className={`rounded-xl border p-3 transition-all duration-200 ${
          isHighRisk
            ? "border-red-500/40 bg-gradient-to-b from-red-500/[0.06] to-sentinel-surface/90 shadow-sm"
            : "border-sentinel-line/80 bg-sentinel-surface hover:border-sentinel-line"
        }`}
      >
        {/* Header: Risk + Timestamp */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Risk risk={approval.risk} />
            {isHighRisk && (
              <span className="rounded bg-red-500/15 px-1.5 py-0.2 text-[9px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wider">
                Sign-off
              </span>
            )}
          </div>
          <time className="font-mono text-[10px] text-sentinel-muted">
            {displayTime(approval.requestedAt)}
          </time>
        </div>

        {/* Agent Info & Request */}
        <div className="mt-2.5 flex items-start gap-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-sentinel-line bg-sentinel-canvas text-sentinel-lime">
            {approval.agentName.includes("GitHub") ? (
              <GitBranch className="h-3 w-3" />
            ) : (
              <Bot className="h-3 w-3" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-xs text-sentinel-text truncate">
              {approval.agentName}
            </div>
            <p className="text-[11px] text-sentinel-muted truncate mt-0.5">
              {approval.request}
            </p>
          </div>
        </div>

        {/* Target Resource Box */}
        <div className="mt-2 rounded-lg border border-sentinel-line/70 bg-sentinel-canvas/70 px-2.5 py-1.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-sentinel-muted">
            Target Resource
          </div>
          <code className="block font-mono text-[10px] text-sentinel-text truncate mt-0.5" title={approval.resource}>
            {approval.resource}
          </code>
        </div>

        {/* Context Snippet */}
        <p className="mt-2 text-[11px] leading-relaxed text-sentinel-muted line-clamp-2" title={approval.context}>
          {approval.context}
        </p>

        {approval.requestedBy && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-sentinel-muted truncate">
            <User className="h-3 w-3 shrink-0 text-sentinel-muted" />
            <span className="truncate">Requester: {approval.requestedBy}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-sentinel-line/40">
          <button
            type="button"
            className="primary-button py-1.5 text-xs justify-center gap-1.5"
            disabled={!canDecide || Boolean(pendingDecision)}
            onClick={() => void submitDecision("approved")}
          >
            {pendingDecision === "approved" ? (
              <LoaderCircle className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            <span>{pendingDecision === "approved" ? "Approving…" : "Approve"}</span>
          </button>
          <button
            type="button"
            className="secondary-button py-1.5 text-xs justify-center gap-1.5"
            disabled={!canDecide || Boolean(pendingDecision)}
            onClick={() => void submitDecision("denied")}
          >
            {pendingDecision === "denied" ? (
              <LoaderCircle className="h-3 w-3 animate-spin" />
            ) : (
              <XCircle className="h-3 w-3" />
            )}
            <span>{pendingDecision === "denied" ? "Denying…" : "Deny"}</span>
          </button>
        </div>
      </article>
    );
  }

  // Full detailed card for 3-column /approvals page
  return (
    <article
      className={`approval-card min-w-0 overflow-hidden transition-all duration-200 ${
        isHighRisk
          ? "border-red-500/30 bg-gradient-to-b from-red-500/[0.04] to-transparent shadow-sm"
          : ""
      }`}
    >
      <div className="approval-meta">
        <div className="flex items-center gap-2">
          <Risk risk={approval.risk} />
          {isHighRisk && (
            <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-red-500 dark:text-red-400">
              Sign-Off Required
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyId}
            title="Click to copy Request ID"
            className="flex items-center gap-1 rounded border border-sentinel-line/80 bg-sentinel-canvas/70 px-1.5 py-0.5 font-mono text-[9px] text-sentinel-muted hover:text-sentinel-text hover:border-sentinel-line"
          >
            {copied ? <Check className="h-2.5 w-2.5 text-sentinel-lime" /> : <Copy className="h-2.5 w-2.5" />}
            <span>#{approval.id.slice(0, 7)}</span>
          </button>
          <time className="text-[9px] text-sentinel-muted font-mono">{displayTime(approval.requestedAt)}</time>
        </div>
      </div>

      <div className="approval-title">
        <span className="agent-icon">
          {approval.agentName.includes("GitHub") ? <GitBranch /> : <Bot />}
        </span>
        <div>
          <strong>{approval.agentName}</strong>
          <span>{approval.request}</span>
        </div>
      </div>

      <dl>
        <div>
          <dt>Resource</dt>
          <dd className="min-w-0 break-words [overflow-wrap:anywhere]" title={approval.resource}>
            <code className="rounded border border-sentinel-line/70 bg-sentinel-canvas/80 px-1.5 py-0.5 font-mono text-[10px] text-sentinel-text">
              {approval.resource}
            </code>
          </dd>
        </div>
        {approval.requestedBy ? (
          <div>
            <dt>Requester</dt>
            <dd className="min-w-0 break-words [overflow-wrap:anywhere] flex items-center gap-1 text-sentinel-text font-medium">
              <User className="h-2.5 w-2.5 text-sentinel-muted shrink-0" />
              <span className="truncate">{approval.requestedBy}</span>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Context</dt>
          <dd className={`min-w-0 break-words [overflow-wrap:anywhere] ${expanded ? "" : "line-clamp-2"}`} title={approval.context}>
            {approval.context}
          </dd>
        </div>
      </dl>

      {expanded && (
        <div className="mb-3 rounded-lg border border-sentinel-line/60 bg-sentinel-canvas/70 p-3 text-[11px] space-y-2">
          <div className="flex items-center justify-between text-sentinel-muted text-[10px]">
            <span className="font-semibold text-sentinel-text">Governance & Impact Assessment</span>
            <span className="font-mono text-[9px] text-sentinel-muted">UUID: {approval.id}</span>
          </div>
          <p className="text-sentinel-muted leading-relaxed text-[10px]">
            Zero-trust policy engine intercepted this mutation because target <span className="font-mono font-medium text-sentinel-text">{approval.resource}</span> contains production-impacting permissions. Execution remains paused until an authorized reviewer signs off.
          </p>
          <div className="pt-2 border-t border-sentinel-line/40 text-[10px] text-sentinel-muted flex items-center justify-between">
            <span>Trigger: Production Mutation Policy</span>
            <span className="font-mono text-amber-500 dark:text-amber-400 font-medium">Status: Awaiting Human Sign-Off</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-sentinel-line/40">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-semibold text-sentinel-lime hover:underline cursor-pointer"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span>{expanded ? "Hide details" : "Show details"}</span>
        </button>
      </div>

      <div className="approval-actions mt-3">
        <button
          className="primary-button"
          disabled={!canDecide || Boolean(pendingDecision)}
          onClick={() => void submitDecision("approved")}
        >
          {pendingDecision === "approved" ? <LoaderCircle className="animate-spin" /> : <Check />}
          {pendingDecision === "approved" ? "Approving…" : "Approve"}
        </button>
        <button
          className="secondary-button"
          disabled={!canDecide || Boolean(pendingDecision)}
          onClick={() => void submitDecision("denied")}
        >
          {pendingDecision === "denied" ? <LoaderCircle className="animate-spin" /> : <XCircle />}
          {pendingDecision === "denied" ? "Denying…" : "Deny"}
        </button>
      </div>
    </article>
  );
}
