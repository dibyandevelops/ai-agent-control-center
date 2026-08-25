"use client";

import Image from "next/image";
import {
  Activity,
  Code2,
  Database,
  Headphones,
  KeyRound,
  Landmark,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const agents = [
  { id: "finance", label: "Finance Agent", risk: "High", action: "stripe.refund.issue", policy: "POL-003 Ceiling Check", latency: 12.8, icon: Landmark },
  { id: "release", label: "Release Agent", risk: "Critical", action: "github.release.publish", policy: "POL-004 Dual Quorum", latency: 14.2, icon: Code2 },
  { id: "support", label: "Support Agent", risk: "Low", action: "tickets.read", policy: "POL-001 PII Redaction", latency: 9.4, icon: Headphones },
  { id: "data", label: "Data Pipeline", risk: "Medium", action: "s3.export.dataset", policy: "POL-002 Egress Guard", latency: 15.6, icon: Database },
] as const;

export function ControlPlaneScene() {
  const [selected, setSelected] = useState<typeof agents[number]["id"]>("release");
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [liveLatency, setLiveLatency] = useState(14.2);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedAgent = agents.find((agent) => agent.id === selected) ?? agents[1];

  // Auto-cycle through agents when not actively hovered
  useEffect(() => {
    if (isHovered) return;
    const interval = setInterval(() => {
      setSelected((curr) => {
        const nextIdx = (agents.findIndex((a) => a.id === curr) + 1) % agents.length;
        return agents[nextIdx].id;
      });
    }, 4200);
    return () => clearInterval(interval);
  }, [isHovered]);

  // Micro-fluctuation for real-time latency readout
  useEffect(() => {
    const timer = setInterval(() => {
      const base = selectedAgent.latency;
      const jitter = (Math.random() * 0.8 - 0.4);
      setLiveLatency(Number((base + jitter).toFixed(1)));
    }, 1800);
    return () => clearInterval(timer);
  }, [selectedAgent]);

  // Smooth 3D parallax tilt handler
  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({
      rotateX: Number((-y * 10).toFixed(2)),
      rotateY: Number((x * 12).toFixed(2)),
    });
  }

  function handleMouseLeave() {
    setIsHovered(false);
    setTilt({ rotateX: 0, rotateY: 0 });
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(1200px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
        transformStyle: "preserve-3d",
      }}
      className="relative min-h-[580px] lg:min-h-[660px] overflow-hidden rounded-3xl border border-sentinel-line bg-sentinel-surface shadow-2xl shadow-sentinel-lime/5 transition-transform duration-300 ease-out group select-none"
    >
      {/* 3D Render Image Background with Cybernetic Vignette */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/sentinel-control-plane-3d.jpg"
          alt="SentinelOps Zero-Trust AI Agent 3D Control Plane"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 800px"
          className="object-cover object-center brightness-95 contrast-105 transition-transform duration-700 group-hover:scale-[1.03]"
        />
        {/* Animated Cybernetic Scanline Laser Pulse */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-400/[0.07] to-transparent h-24 w-full animate-[pulse_3s_ease-in-out_infinite] pointer-events-none" />
        
        {/* Vignette & Radial Atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_30%,rgba(0,0,0,0.65)_100%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(183,243,74,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(183,243,74,0.05)_1px,transparent_1px)] bg-[length:32px_32px] pointer-events-none" />
      </div>

      {/* Top Left Status Beacon */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-full border border-emerald-500/40 bg-black/75 px-3.5 py-1.5 backdrop-blur-xl shadow-xl transition-transform duration-300 group-hover:translate-z-6">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="font-mono text-[11px] font-bold tracking-wider text-emerald-400 uppercase">
          Zero-Trust Gateway Online
        </span>
      </div>

      {/* Top Right Quorum HUD Widget */}
      <div className="absolute top-4 right-4 z-10 hidden sm:flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-black/75 px-4 py-2 backdrop-blur-xl shadow-xl transition-transform duration-300 group-hover:translate-z-6">
        <KeyRound className="h-4 w-4 text-amber-400 animate-pulse" />
        <div className="text-left">
          <div className="text-[11px] font-bold text-white">Dual-Custody Quorum</div>
          <div className="font-mono text-[9px] text-amber-300/80">2 of 2 Approvals Required</div>
        </div>
      </div>

      {/* Interactive Agent Telemetry Strip (Left Side) */}
      <div className="absolute left-4 top-16 z-10 flex flex-col gap-2 max-w-[215px]">
        <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300 px-1 drop-shadow-sm flex items-center justify-between">
          <span>Connected Agents</span>
          <Activity className="h-3 w-3 text-emerald-400 animate-pulse" />
        </div>
        {agents.map(({ id, label, risk, icon: Icon }) => {
          const isSelected = selected === id;
          return (
            <button
              type="button"
              key={id}
              onClick={() => setSelected(id)}
              onMouseEnter={() => setSelected(id)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all backdrop-blur-xl ${
                isSelected
                  ? "border-emerald-400 bg-emerald-950/80 text-white shadow-[0_0_24px_rgba(16,185,129,0.35)] translate-x-1.5 scale-[1.02]"
                  : "border-white/10 bg-black/65 text-slate-200 hover:border-white/25 hover:bg-black/80 hover:text-white"
              }`}
            >
              <Icon className={`h-4 w-4 shrink-0 transition-colors ${isSelected ? "text-emerald-400" : "text-slate-300"}`} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold">{label}</div>
                <div className="text-[9px] text-slate-300/80 font-mono">{risk} Risk</div>
              </div>
              {isSelected && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-ping" />
              )}
            </button>
          );
        })}
      </div>

      {/* Active Evaluation Telemetry Card (Bottom Right Floating Glass) */}
      <div className="absolute bottom-4 right-4 left-4 sm:left-auto z-10 sm:max-w-[340px] rounded-2xl border border-white/15 bg-black/85 p-4 backdrop-blur-2xl shadow-2xl space-y-2.5 text-white transition-all duration-300">
        <div className="flex items-center justify-between border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <strong className="text-xs font-bold text-white">{selectedAgent.label}</strong>
          </div>
          <span className="rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-400 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" /> Sub-20ms SLA
          </span>
        </div>

        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Action:</span>
            <span className="font-semibold text-white truncate max-w-[190px]">{selectedAgent.action}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Enforced Rule:</span>
            <span className="font-semibold text-amber-300 truncate max-w-[190px]">{selectedAgent.policy}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span className="text-slate-400">Live Latency:</span>
            <span className="font-bold text-emerald-400 flex items-center gap-1">
              <Zap className="h-3 w-3" /> {liveLatency} ms
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-white/10 text-[10px]">
          <span className="flex items-center gap-1 text-slate-300">
            <ShieldCheck className="h-3 w-3 text-emerald-400" /> SHA-256 Audit Anchored
          </span>
          <span className="text-emerald-400 font-bold">100% Policy Pass</span>
        </div>
      </div>
    </div>
  );
}
