"use client";

import Image from "next/image";
import {
  Code2,
  Database,
  Headphones,
  KeyRound,
  Landmark,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useState } from "react";

const agents = [
  { id: "finance", label: "Finance Agent", risk: "High", action: "stripe.refund.issue", policy: "POL-003 Ceiling Check", icon: Landmark },
  { id: "release", label: "Release Agent", risk: "Critical", action: "github.release.publish", policy: "POL-004 Dual Quorum", icon: Code2 },
  { id: "support", label: "Support Agent", risk: "Low", action: "tickets.read", policy: "POL-001 PII Redaction", icon: Headphones },
  { id: "data", label: "Data Pipeline", risk: "Medium", action: "s3.export.dataset", policy: "POL-002 Egress Guard", icon: Database },
] as const;

export function ControlPlaneScene() {
  const [selected, setSelected] = useState<typeof agents[number]["id"]>("release");
  const selectedAgent = agents.find((agent) => agent.id === selected) ?? agents[0];

  return (
    <div className="relative min-h-[580px] lg:min-h-[660px] overflow-hidden rounded-3xl border border-sentinel-line bg-sentinel-surface shadow-2xl shadow-sentinel-lime/5 transition-all duration-300 group">
      {/* 3D Render Image Background with Dual-Theme Vignette */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/sentinel-control-plane-3d.jpg"
          alt="SentinelOps Zero-Trust AI Agent 3D Control Plane"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 800px"
          className="object-cover object-center brightness-95 contrast-105 transition-transform duration-700 group-hover:scale-[1.02]"
        />
        {/* Dual-Theme Responsive Ambient Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-sentinel-surface/90 via-transparent to-sentinel-surface/30 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_40%,var(--surface)_95%)] opacity-80 pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(183,243,74,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(183,243,74,0.04)_1px,transparent_1px)] bg-[length:32px_32px] pointer-events-none" />
      </div>

      {/* Top Left Status Badge */}
      <div className="absolute top-5 left-5 z-10 flex items-center gap-2 rounded-full border border-emerald-600/30 dark:border-sentinel-lime/40 bg-sentinel-surface/90 px-3.5 py-1.5 backdrop-blur-md shadow-lg">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 dark:bg-sentinel-lime opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 dark:bg-sentinel-lime" />
        </span>
        <span className="font-mono text-[11px] font-bold tracking-wider text-emerald-700 dark:text-sentinel-lime uppercase">
          Zero-Trust Gateway Online
        </span>
      </div>

      {/* Top Right Quorum HUD Widget */}
      <div className="absolute top-5 right-5 z-10 hidden sm:flex items-center gap-3 rounded-2xl border border-sentinel-line bg-sentinel-surface/95 px-4 py-2.5 backdrop-blur-md shadow-xl">
        <KeyRound className="h-4 w-4 text-amber-500 dark:text-amber-400" />
        <div className="text-left">
          <div className="text-[10px] font-bold text-sentinel-text">Dual-Custody Quorum</div>
          <div className="font-mono text-[9px] text-sentinel-muted">2 of 2 Approvals Required</div>
        </div>
      </div>

      {/* Interactive Agent Telemetry Strip (Left Side) */}
      <div className="absolute left-5 top-20 z-10 flex flex-col gap-2.5 max-w-[200px]">
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-sentinel-muted px-1">
          Connected Agents
        </div>
        {agents.map(({ id, label, risk, icon: Icon }) => (
          <button
            type="button"
            key={id}
            onClick={() => setSelected(id)}
            onMouseEnter={() => setSelected(id)}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all backdrop-blur-md ${
              selected === id
                ? "border-emerald-600/60 dark:border-sentinel-lime bg-sentinel-surface/95 shadow-lg shadow-emerald-500/10 dark:shadow-sentinel-lime/10 translate-x-1 text-sentinel-text"
                : "border-sentinel-line bg-sentinel-surface/80 text-sentinel-muted hover:border-sentinel-line-strong hover:text-sentinel-text"
            }`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${selected === id ? "text-emerald-600 dark:text-sentinel-lime" : "text-sentinel-muted"}`} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">{label}</div>
              <div className="text-[9px] text-sentinel-muted font-mono">{risk} Risk</div>
            </div>
            {selected === id && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-sentinel-lime shadow-[0_0_8px_#10b981] dark:shadow-[0_0_8px_#b7f34a]" />
            )}
          </button>
        ))}
      </div>

      {/* Active Evaluation Telemetry Card (Bottom Right Floating Glass) */}
      <div className="absolute bottom-5 right-5 left-5 sm:left-auto z-10 sm:max-w-[340px] rounded-2xl border border-sentinel-line bg-sentinel-surface/95 p-4 backdrop-blur-xl shadow-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-sentinel-line pb-2.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-sentinel-lime" />
            <strong className="text-xs font-bold text-sentinel-text">{selectedAgent.label}</strong>
          </div>
          <span className="rounded-full bg-emerald-500/15 dark:bg-sentinel-lime/15 border border-emerald-500/30 dark:border-sentinel-lime/30 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-sentinel-lime">
            Sub-20ms SLA
          </span>
        </div>

        <div className="space-y-1.5 font-mono text-[11px]">
          <div className="flex justify-between text-sentinel-muted">
            <span>Action:</span>
            <span className="font-semibold text-sentinel-text truncate max-w-[190px]">{selectedAgent.action}</span>
          </div>
          <div className="flex justify-between text-sentinel-muted">
            <span>Enforced Rule:</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400 truncate max-w-[190px]">{selectedAgent.policy}</span>
          </div>
          <div className="flex justify-between text-sentinel-muted">
            <span>Latency:</span>
            <span className="font-semibold text-emerald-700 dark:text-sentinel-lime">14.2 ms</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-sentinel-line text-[10px]">
          <span className="flex items-center gap-1 text-sentinel-muted">
            <Zap className="h-3 w-3 text-emerald-600 dark:text-sentinel-lime" /> SHA-256 Audit Anchored
          </span>
          <span className="text-emerald-700 dark:text-sentinel-lime font-bold">100% Policy Pass</span>
        </div>
      </div>
    </div>
  );
}
