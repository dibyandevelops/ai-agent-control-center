"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import React, { useState } from "react";

interface Scenario {
  id: string;
  name: string;
  agent: string;
  action: string;
  risk: "low" | "medium" | "high";
  payload: Record<string, unknown>;
  decision: "allow" | "require_approval" | "block";
  policyTriggered: string;
  latencyMs: number;
}

const scenarios: Scenario[] = [
  {
    id: "sc-deploy",
    name: "Production Release",
    agent: "GitHub Release Assistant",
    action: "github.release.publish",
    risk: "high",
    payload: {
      repository: "sentinelops/core-engine",
      tag: "v2.4.0-prod",
      targetBranch: "main",
      signOffRequired: true,
    },
    decision: "require_approval",
    policyTriggered: "Production Deployment Dual-Signoff (POL-004)",
    latencyMs: 14,
  },
  {
    id: "sc-pii",
    name: "Exfiltrate Customer PII",
    agent: "Customer Support Agent",
    action: "tickets.bulk_export",
    risk: "high",
    payload: {
      ticketCount: 840,
      fields: ["email", "creditCardLast4", "ssnHash"],
      destination: "https://external-webhook.xyz",
    },
    decision: "block",
    policyTriggered: "Prevent Sensitive PII Data Exfiltration (POL-001)",
    latencyMs: 8,
  },
  {
    id: "sc-reconcile",
    name: "Ledger Read & Match",
    agent: "Finance Reconciliation Agent",
    action: "finance.ledger.read",
    risk: "low",
    payload: {
      fiscalQuarter: "Q3-2026",
      limit: 100,
      scope: "read_only",
    },
    decision: "allow",
    policyTriggered: "Standard Financial Read Bounds (POL-007)",
    latencyMs: 11,
  },
  {
    id: "sc-refund",
    name: "High-Value Refund ($12k)",
    agent: "Support Resolution Agent",
    action: "stripe.refund.issue",
    risk: "high",
    payload: {
      amount: 12500,
      currency: "USD",
      customerTier: "Enterprise",
    },
    decision: "require_approval",
    policyTriggered: "Autonomous Refund Ceiling > $1,000 (POL-003)",
    latencyMs: 16,
  },
];

export function InteractiveSandbox() {
  const [selectedScenario, setSelectedScenario] = useState<Scenario>(scenarios[0]);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluated, setEvaluated] = useState<Scenario | null>(scenarios[0]);

  async function handleSimulate(scenario: Scenario) {
    setSelectedScenario(scenario);
    setEvaluating(true);
    setEvaluated(null);
    await new Promise((r) => setTimeout(r, 450));
    setEvaluating(false);
    setEvaluated(scenario);
  }

  return (
    <section className="relative mx-auto max-w-[1380px] px-6 py-20 lg:py-28" id="sandbox">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-sentinel-lime/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-sentinel-lime/30 bg-sentinel-lime/10 px-3.5 py-1 text-xs font-semibold text-sentinel-lime mb-4">
          <Sparkles className="h-3.5 w-3.5" />
          Interactive Live Policy Engine
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-sentinel-text">
          Zero-Trust Gateway in Action
        </h2>
        <p className="mt-4 text-base sm:text-lg text-sentinel-muted leading-relaxed">
          Test how SentinelOps evaluates synthetic agent actions in sub-20ms before execution happens.
        </p>
      </div>

      {/* Interactive Terminal Sandbox Card */}
      <div className="rounded-3xl border border-sentinel-line bg-sentinel-surface/90 shadow-2xl backdrop-blur-xl overflow-hidden">
        {/* Card Header with Scenario Selector */}
        <div className="border-b border-sentinel-line bg-sentinel-canvas/60 px-5 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex gap-1.5">
              <span className="h-3 w-3 rounded-full bg-red-500/70 inline-block" />
              <span className="h-3 w-3 rounded-full bg-amber-500/70 inline-block" />
              <span className="h-3 w-3 rounded-full bg-sentinel-lime/70 inline-block" />
            </span>
            <span className="ml-3 font-mono text-xs text-sentinel-muted flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-sentinel-dim" /> gateway.sentinelops.internal:443
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-sentinel-muted mr-1">Select Scenario:</span>
            {scenarios.map((sc) => (
              <button
                key={sc.id}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selectedScenario.id === sc.id
                    ? "bg-sentinel-lime text-sentinel-canvas shadow-sm"
                    : "border border-sentinel-line bg-sentinel-surface text-sentinel-muted hover:text-sentinel-text hover:border-sentinel-line-strong"
                }`}
                onClick={() => void handleSimulate(sc)}
              >
                {sc.name}
              </button>
            ))}
          </div>
        </div>

        {/* Card Body: 2-Column Evaluation Simulator */}
        <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-sentinel-line">
          {/* Left Column: Synthetic Agent Action Request Payload */}
          <div className="p-6 lg:p-8 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-sentinel-lime" />
                  <strong className="text-xs font-semibold text-sentinel-text uppercase tracking-wider">
                    Agent Action Payload
                  </strong>
                </div>
                <span className="font-mono text-[11px] text-sentinel-muted">POST /api/v1/actions/evaluate</span>
              </div>

              <div className="rounded-2xl border border-sentinel-line bg-sentinel-canvas p-4 font-mono text-xs text-sentinel-text space-y-2">
                <p className="text-sentinel-dim">{`// Inbound autonomous request`}</p>
                <p>
                  <span className="text-cyan-400">&quot;agent&quot;</span>: <span className="text-amber-300">&quot;{selectedScenario.agent}&quot;</span>,
                </p>
                <p>
                  <span className="text-cyan-400">&quot;action&quot;</span>: <span className="text-amber-300">&quot;{selectedScenario.action}&quot;</span>,
                </p>
                <p>
                  <span className="text-cyan-400">&quot;riskLevel&quot;</span>: <span className="text-purple-400">&quot;{selectedScenario.risk}&quot;</span>,
                </p>
                <p>
                  <span className="text-cyan-400">&quot;parameters&quot;</span>: {JSON.stringify(selectedScenario.payload, null, 2)}
                </p>
              </div>
            </div>

            <button
              type="button"
              className="primary-button w-full justify-center text-sm py-3.5 font-bold shadow-lg shadow-sentinel-lime/10"
              onClick={() => void handleSimulate(selectedScenario)}
              disabled={evaluating}
            >
              {evaluating ? (
                <RotateCcw className="animate-spin h-4 w-4" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {evaluating ? "Evaluating Policy Rules…" : "Simulate Gateway Enforcement"}
            </button>
          </div>

          {/* Right Column: Gateway Decision Engine Result */}
          <div className="p-6 lg:p-8 bg-sentinel-canvas/40 flex flex-col justify-between space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-sentinel-lime" />
                  <strong className="text-xs font-semibold text-sentinel-text uppercase tracking-wider">
                    Governance Decision Output
                  </strong>
                </div>
                {evaluated && (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-sentinel-lime">
                    <Activity className="h-3 w-3" /> {evaluated.latencyMs}ms latency
                  </span>
                )}
              </div>

              {evaluating ? (
                <div className="h-64 grid place-items-center rounded-2xl border border-sentinel-line bg-sentinel-canvas p-6 text-center">
                  <div className="space-y-3">
                    <div className="inline-grid h-12 w-12 place-items-center rounded-full bg-sentinel-lime/10 text-sentinel-lime animate-pulse mx-auto">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <p className="text-xs font-semibold text-sentinel-text">Evaluating 12 active security rules…</p>
                    <p className="text-[11px] text-sentinel-muted">Checking PII boundaries, velocity limits, and dual-custody gates.</p>
                  </div>
                </div>
              ) : evaluated ? (
                <div className="space-y-4">
                  {/* Decision Banner */}
                  <div
                    className={`rounded-2xl border p-4 flex items-start gap-3.5 ${
                      evaluated.decision === "allow"
                        ? "border-sentinel-lime/40 bg-sentinel-lime/10"
                        : evaluated.decision === "require_approval"
                        ? "border-amber-400/40 bg-amber-400/10"
                        : "border-red-400/40 bg-red-400/10"
                    }`}
                  >
                    <div className="mt-0.5">
                      {evaluated.decision === "allow" ? (
                        <CheckCircle2 className="h-6 w-6 text-sentinel-lime" />
                      ) : evaluated.decision === "require_approval" ? (
                        <AlertTriangle className="h-6 w-6 text-amber-400" />
                      ) : (
                        <ShieldAlert className="h-6 w-6 text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-sm font-bold uppercase tracking-wider text-sentinel-text">
                          {evaluated.decision === "allow"
                            ? "ALLOW — Action Permitted"
                            : evaluated.decision === "require_approval"
                            ? "REQUIRE APPROVAL — Routed to Human Quorum"
                            : "BLOCK — Action Halted & Logged"}
                        </strong>
                      </div>
                      <p className="mt-1 text-xs text-sentinel-text/85">
                        Matched Rule: <strong>{evaluated.policyTriggered}</strong>
                      </p>
                    </div>
                  </div>

                  {/* Forensic Evidence Detail Box */}
                  <div className="rounded-2xl border border-sentinel-line bg-sentinel-canvas p-4 space-y-2.5 font-mono text-xs">
                    <div className="flex items-center justify-between text-[11px] border-b border-sentinel-line pb-2">
                      <span className="text-sentinel-muted">Cryptographic Proof:</span>
                      <span className="text-sentinel-lime truncate max-w-[200px]">sha256:8f4b29a1c0d8…e49</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] border-b border-sentinel-line pb-2">
                      <span className="text-sentinel-muted">Enforcement SLA:</span>
                      <span className="text-sentinel-text font-semibold">{evaluated.latencyMs} ms (Sub-20ms guarantee)</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-sentinel-muted">Audit Hash Chain:</span>
                      <span className="text-sentinel-lime font-semibold">Anchored & Sealed</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-sentinel-line/70 bg-sentinel-surface px-4 py-3 text-xs text-sentinel-muted flex items-center justify-between">
              <span>Ready to enforce policies on your real agents?</span>
              <a
                href="/dashboard"
                className="font-semibold text-sentinel-lime inline-flex items-center gap-1 hover:underline"
              >
                Launch Control Center <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
