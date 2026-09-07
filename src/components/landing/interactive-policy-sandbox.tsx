"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  Copy,
  Lock,
  MessageSquare,
  Play,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import Link from "next/link";

interface SandboxPreset {
  id: string;
  name: string;
  category: "Safe Read" | "High-Risk HITL" | "Destructive";
  badgeColor: string;
  agentId: string;
  action: string;
  resource: string;
  risk: "low" | "medium" | "high";
  context: Record<string, unknown>;
  expectedOutcome: "allowed" | "pending" | "blocked";
  explanation: string;
}

const PRESETS: SandboxPreset[] = [
  {
    id: "safe-read",
    name: "Safe Read (Analytical Query)",
    category: "Safe Read",
    badgeColor: "text-emerald-700 dark:text-sentinel-lime bg-emerald-500/10 border-emerald-500/20",
    agentId: "analytics-copilot-01",
    action: "database.query.read",
    resource: "warehouse://snowflake/active_subscribers",
    risk: "low",
    context: {
      query: "SELECT count(*) FROM subscribers WHERE active = true",
      readOnly: true,
      maxRows: 1000,
    },
    expectedOutcome: "allowed",
    explanation: "Standard analytical reads match zero-trust read-only policy. Evaluated & authorized in <15ms without friction.",
  },
  {
    id: "high-risk-wire",
    name: "High-Risk Wire ($35,000 USD)",
    category: "High-Risk HITL",
    badgeColor: "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    agentId: "finance-ops-agent",
    action: "banking.wire.transfer",
    resource: "bank://jpmorgan/wire-out",
    risk: "high",
    context: {
      amount: 35000,
      currency: "USD",
      recipientIban: "DE89370400440532013000",
      vendor: "Cloud Infrastructure LLC",
    },
    expectedOutcome: "pending",
    explanation: "Financial operations exceeding $1,000 trigger Four-Eyes Dual-Authorization. Action halts and alerts Slack security channel.",
  },
  {
    id: "destructive-mutation",
    name: "Destructive Mutation (DROP TABLE)",
    category: "Destructive",
    badgeColor: "text-red-700 dark:text-red-400 bg-red-500/10 border-red-500/20",
    agentId: "devops-assistant-prod",
    action: "postgres.schema.drop_table",
    resource: "postgres://production/customer_records",
    risk: "high",
    context: {
      command: "DROP TABLE customer_records CASCADE;",
      environment: "production",
    },
    expectedOutcome: "blocked",
    explanation: "Destructive schema drops on production environments are hard-forbidden by enterprise policy. Execution rejected instantly.",
  },
];

async function sha256Hex(data: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`;
  }
  const encoder = new TextEncoder();
  const buffer = await window.crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(buffer));
  return `sha256:${hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function InteractivePolicySandbox() {
  const [selectedPreset, setSelectedPreset] = useState<SandboxPreset>(PRESETS[0]);
  const [agentId, setAgentId] = useState(PRESETS[0].agentId);
  const [action, setAction] = useState(PRESETS[0].action);
  const [resource, setResource] = useState(PRESETS[0].resource);
  const [risk, setRisk] = useState<"low" | "medium" | "high">(PRESETS[0].risk);
  const [contextStr, setContextStr] = useState(JSON.stringify(PRESETS[0].context, null, 2));

  // Evaluation simulation state
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{
    status: "allowed" | "pending" | "approved" | "denied" | "blocked";
    latencyMs: number;
    reason: string;
    requestId: string;
    hash: string;
    evaluatedAt: string;
  } | null>({
    status: "allowed",
    latencyMs: 14.2,
    reason: "Standard analytical reads match zero-trust read-only policy. Evaluated & authorized in <15ms without friction.",
    requestId: "req_demo_read_01",
    hash: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    evaluatedAt: "2026-09-07T00:00:00.000Z",
  });

  // HITL Slack Interactive state
  const [slackApproved, setSlackApproved] = useState<boolean | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const handleSelectPreset = (preset: SandboxPreset) => {
    setSelectedPreset(preset);
    setAgentId(preset.agentId);
    setAction(preset.action);
    setResource(preset.resource);
    setRisk(preset.risk);
    setContextStr(JSON.stringify(preset.context, null, 2));
    setSlackApproved(null);

    // Provide immediate preset feedback
    if (preset.expectedOutcome === "allowed") {
      setEvaluationResult({
        status: "allowed",
        latencyMs: 13.8,
        reason: preset.explanation,
        requestId: `req_${preset.id}`,
        hash: "sha256:4a8b79e2c65f013d8e5a7b2c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e",
        evaluatedAt: new Date().toISOString(),
      });
    } else if (preset.expectedOutcome === "pending") {
      setEvaluationResult({
        status: "pending",
        latencyMs: 15.4,
        reason: preset.explanation,
        requestId: `req_${preset.id}`,
        hash: "sha256:9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e4a8b79e2c65f013d8e5a7b2c9d1e3f5a7b",
        evaluatedAt: new Date().toISOString(),
      });
    } else {
      setEvaluationResult({
        status: "blocked",
        latencyMs: 12.1,
        reason: preset.explanation,
        requestId: `req_${preset.id}`,
        hash: "sha256:7f9a1b3c5d7e4a8b79e2c65f013d8e5a7b2c9d1e3f5a7b9c1d3e5f7a9b1c3d5e",
        evaluatedAt: new Date().toISOString(),
      });
    }
  };

  const runEvaluation = async () => {
    setEvaluating(true);
    setSlackApproved(null);

    const start = performance.now();
    // Simulate real sub-20ms distributed policy execution
    const simulatedDelay = Math.floor(Math.random() * 8) + 12; // 12-19ms
    await new Promise((r) => setTimeout(r, simulatedDelay));
    const elapsed = Math.round((performance.now() - start) * 10) / 10;

    let parsedContext = {};
    try {
      parsedContext = JSON.parse(contextStr);
    } catch {
      // Ignored
    }

    const payloadString = JSON.stringify({ agentId, action, resource, risk, parsedContext, ts: Date.now() });
    const hash = await sha256Hex(payloadString);
    const requestId = `req_${Math.random().toString(36).substring(2, 11)}`;

    let status: "allowed" | "pending" | "blocked" = "allowed";
    let reason = "Evaluated against Zero-Trust Policy Set: Allowed.";

    if (action.includes("drop") || action.includes("delete") || (resource.includes("production") && risk === "high" && !action.includes("read"))) {
      status = "blocked";
      reason = "Policy Rule #104 [Strict Prod Lockdown]: Destructive mutations hard-forbidden.";
    } else if (risk === "high" || action.includes("wire") || action.includes("transfer") || ((parsedContext as { amount?: number }).amount && (parsedContext as { amount?: number }).amount! > 1000)) {
      status = "pending";
      reason = "Policy Rule #201 [4-Eyes Dual Control]: Financial and high-impact actions require administrator sign-off.";
    }

    setEvaluationResult({
      status,
      latencyMs: elapsed,
      reason,
      requestId,
      hash,
      evaluatedAt: new Date().toISOString(),
    });
    setEvaluating(false);
  };

  const handleSlackDecision = async (approved: boolean) => {
    setSlackApproved(approved);
    if (!evaluationResult) return;

    const updatedStatus = approved ? "approved" : "denied";
    const newHash = await sha256Hex(`${evaluationResult.hash}:reviewed:${updatedStatus}`);

    setEvaluationResult((curr) =>
      curr
        ? {
            ...curr,
            status: updatedStatus,
            reason: approved
              ? "Dual-Authorization granted by Lead Administrator in Slack (#sec-approvals)."
              : "Dual-Authorization rejected by Lead Administrator.",
            hash: newHash,
          }
        : null,
    );
  };

  const copyHash = async () => {
    if (!evaluationResult?.hash) return;
    await navigator.clipboard.writeText(evaluationResult.hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="rounded-3xl border border-sentinel-line bg-sentinel-surface p-6 sm:p-8 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-sentinel-line">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-xs font-semibold text-emerald-700 dark:text-sentinel-lime mb-2">
            <Sparkles className="h-3 w-3" />
            <span>Interactive Policy Playground</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-sentinel-text">
            Live Zero-Trust Policy Simulator
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-sentinel-muted">
            Simulate consequential agent tool calls and watch sub-20ms evaluation, Slack 4-Eyes review, and cryptographic seals live.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-sentinel-lime">
            Sub-20ms SLA Online
          </span>
        </div>
      </div>

      {/* Presets Navigation */}
      <div className="pt-6">
        <span className="text-xs font-bold uppercase tracking-wider text-sentinel-muted block mb-3">
          Select Real-World Threat Scenario:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {PRESETS.map((preset) => {
            const isSelected = selectedPreset.id === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition ${
                  isSelected
                    ? "border-emerald-500/50 dark:border-sentinel-lime/50 bg-sentinel-canvas ring-2 ring-emerald-500/20 shadow-md"
                    : "border-sentinel-line bg-sentinel-surface hover:bg-sentinel-canvas/60 text-sentinel-muted"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${preset.badgeColor}`}>
                    {preset.category}
                  </span>
                  {isSelected ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-sentinel-lime" /> : null}
                </div>
                <strong className="text-xs font-bold text-sentinel-text mt-1">
                  {preset.name}
                </strong>
                <p className="text-[11px] text-sentinel-muted line-clamp-2 mt-1">
                  {preset.explanation}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Simulator Grid */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Request Inspector & Editor (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-sentinel-line bg-sentinel-canvas p-5">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-sentinel-line/60">
              <span className="flex items-center gap-2 text-xs font-bold text-sentinel-text">
                <Terminal className="h-4 w-4 text-emerald-600 dark:text-sentinel-lime" />
                Agent Tool Request Payload
              </span>
              <button
                onClick={() => handleSelectPreset(selectedPreset)}
                className="text-[11px] text-sentinel-muted hover:text-sentinel-text flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-sentinel-muted mb-1">
                  Agent ID
                </label>
                <input
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-sentinel-line bg-sentinel-surface px-3 font-mono text-xs text-sentinel-text outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-sentinel-muted mb-1">
                  Risk Declaration
                </label>
                <select
                  value={risk}
                  onChange={(e) => setRisk(e.target.value as "low" | "medium" | "high")}
                  className="w-full h-9 rounded-xl border border-sentinel-line bg-sentinel-surface px-2.5 font-mono text-xs text-sentinel-text outline-none focus:border-emerald-500"
                >
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk (HITL Trigger)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-sentinel-muted mb-1">
                  Action Name
                </label>
                <input
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="w-full h-9 rounded-xl border border-sentinel-line bg-sentinel-surface px-3 font-mono text-xs text-sentinel-text outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-sentinel-muted mb-1">
                  Target Resource URI
                </label>
                <input
                  value={resource}
                  onChange={(e) => setResource(e.target.value)}
                  className="w-full h-9 rounded-xl border border-sentinel-line bg-sentinel-surface px-3 font-mono text-xs text-sentinel-text outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-sentinel-muted mb-1">
                Context / Arguments (JSON)
              </label>
              <textarea
                rows={4}
                value={contextStr}
                onChange={(e) => setContextStr(e.target.value)}
                className="w-full rounded-xl border border-sentinel-line bg-sentinel-surface p-3 font-mono text-xs text-sentinel-text outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            onClick={runEvaluation}
            disabled={evaluating}
            className="mt-4 primary-button w-full justify-center text-xs font-bold py-3 shadow-md shadow-emerald-500/20 dark:shadow-sentinel-lime/20"
          >
            {evaluating ? (
              <span className="flex items-center gap-2">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Evaluating against Zero-Trust Engine…</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Evaluate Policy (&lt;20ms SLA)</span>
              </span>
            )}
          </button>
        </div>

        {/* Right Column: Live Telemetry & Slack Gate (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          {/* Telemetry Card */}
          <div className="rounded-2xl border border-sentinel-line bg-sentinel-canvas p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-sentinel-line/60">
              <span className="text-xs font-bold text-sentinel-text flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-sentinel-lime" />
                Control Plane Decision
              </span>
              {evaluationResult ? (
                <div className="flex items-center gap-1 text-[11px] font-mono text-sentinel-muted">
                  <Clock className="h-3 w-3 text-emerald-600 dark:text-sentinel-lime" />
                  <span>{evaluationResult.latencyMs}ms</span>
                </div>
              ) : null}
            </div>

            {evaluationResult ? (
              <div className="space-y-3">
                {/* Decision Badge */}
                <div
                  className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                    evaluationResult.status === "allowed" || evaluationResult.status === "approved"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-sentinel-lime"
                      : evaluationResult.status === "pending"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                        : "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300"
                  }`}
                >
                  {evaluationResult.status === "allowed" || evaluationResult.status === "approved" ? (
                    <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-sentinel-lime mt-0.5" />
                  ) : evaluationResult.status === "pending" ? (
                    <Clock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                  )}

                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-xs uppercase font-bold tracking-wider">
                        {evaluationResult.status === "allowed"
                          ? "AUTHORIZED (INSTANT PASS)"
                          : evaluationResult.status === "pending"
                            ? "INTERCEPTED (4-EYES APPROVAL)"
                            : evaluationResult.status === "approved"
                              ? "APPROVED BY ADMINISTRATOR"
                              : evaluationResult.status === "denied"
                                ? "DENIED BY OPERATOR"
                                : "BLOCKED (ZERO-TRUST VIOLATION)"}
                      </strong>
                    </div>
                    <p className="text-xs mt-1 leading-relaxed opacity-90">
                      {evaluationResult.reason}
                    </p>
                  </div>
                </div>

                {/* Cryptographic SHA-256 Seal */}
                <div className="rounded-xl border border-sentinel-line/80 bg-sentinel-surface p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sentinel-muted">
                      <Lock className="h-3 w-3 text-emerald-600 dark:text-sentinel-lime" />
                      Cryptographic Event Seal
                    </span>
                    <button
                      onClick={copyHash}
                      className="text-[10px] text-sentinel-muted hover:text-sentinel-text flex items-center gap-1"
                    >
                      {copiedHash ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
                      <span>{copiedHash ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-sentinel-muted break-all select-all">
                    {evaluationResult.hash}
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          {/* Interactive Slack Gate (Appears for pending or after evaluation) */}
          {evaluationResult?.status === "pending" || slackApproved !== null ? (
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/20 p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                  <MessageSquare className="h-4 w-4" />
                  Slack 4-Eyes Dual-Authorization Card
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300">
                  #sec-approvals
                </span>
              </div>

              <div className="rounded-xl border border-purple-500/20 bg-sentinel-surface p-3 text-xs space-y-2">
                <p className="text-sentinel-text font-semibold">
                  ⚠️ Action Review: <span className="font-mono text-purple-600 dark:text-purple-400">{action}</span>
                </p>
                <p className="text-sentinel-muted text-[11px]">
                  Agent <strong className="text-sentinel-text font-mono">{agentId}</strong> requested high-consequence execution.
                </p>

                {slackApproved === null ? (
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleSlackDecision(true)}
                      className="flex-1 rounded-lg bg-emerald-600 py-1.5 px-3 text-xs font-bold text-white hover:bg-emerald-500 transition flex items-center justify-center gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Authorize</span>
                    </button>
                    <button
                      onClick={() => handleSlackDecision(false)}
                      className="flex-1 rounded-lg bg-red-600 py-1.5 px-3 text-xs font-bold text-white hover:bg-red-500 transition flex items-center justify-center gap-1.5"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Deny</span>
                    </button>
                  </div>
                ) : (
                  <div className="pt-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                    {slackApproved ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                    <span>
                      {slackApproved
                        ? "Authorized by security-officer@sentinelops-ai.com"
                        : "Rejected by security-officer@sentinelops-ai.com"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer Call to Action */}
      <div className="mt-8 pt-6 border-t border-sentinel-line flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-sentinel-muted text-center sm:text-left">
          Integrates in 2 lines of code with <strong className="text-sentinel-text">LangChain</strong>,{" "}
          <strong className="text-sentinel-text">Vercel AI SDK</strong>, and Python decorators.
        </p>
        <div className="flex items-center gap-3">
          <Link
            href="/get-started"
            className="primary-button text-xs font-bold py-2.5 px-4 shadow-sm"
          >
            <span>Create Free Workspace</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
