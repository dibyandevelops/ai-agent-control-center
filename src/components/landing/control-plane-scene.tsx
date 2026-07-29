"use client";

import {
  Bot,
  Check,
  Code2,
  Database,
  Headphones,
  Landmark,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useState } from "react";

const agents = [
  { id: "finance", label: "Finance Agent", risk: "High", icon: Landmark },
  { id: "release", label: "Release Agent", risk: "Medium", icon: Code2 },
  { id: "support", label: "Support Agent", risk: "Low", icon: Headphones },
  { id: "data", label: "Data Agent", risk: "Medium", icon: Database },
] as const;

export function ControlPlaneScene() {
  const [selected, setSelected] = useState("finance");
  const selectedAgent = agents.find((agent) => agent.id === selected) ?? agents[0];

  return (
    <div className="relative min-h-[650px] overflow-hidden rounded-3xl border border-[#4f5d6a]/50 bg-[linear-gradient(135deg,rgba(25,35,44,0.45),rgba(7,10,13,0.8))] bg-sentinel-surface shadow-[-30px_40px_100px_rgba(0,0,0,0.38),inset_0_1px_rgba(255,255,255,0.035)] [transform-style:preserve-3d] [transform:rotateY(-4deg)_rotateX(1deg)] max-xl:min-h-[570px] max-lg:min-h-[630px] max-lg:transform-none">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(145,163,179,0.042)_1px,transparent_1px),linear-gradient(90deg,rgba(145,163,179,0.042)_1px,transparent_1px)] bg-[length:36px_36px] [mask-image:radial-gradient(circle_at_50%_50%,black,transparent_82%)]" aria-hidden="true" />
      <div className="absolute left-[4%] top-[105px] z-[3] grid w-1/4 gap-[25px]">
        {agents.map(({ id, label, risk, icon: Icon }, index) => (
          <button
            type="button"
            key={id}
            className={`relative grid min-h-[76px] grid-cols-[38px_1fr] items-center gap-[11px] rounded-[5px] border bg-gradient-to-br from-sentinel-soft to-[#0b1015] p-[11px] text-left text-[#dce1e5] transition ${
              selected === id
                ? "translate-x-[5px] border-sentinel-lime/80 bg-gradient-to-br from-[#19231e] to-[#0b1015]"
                : "border-[#3b4650] hover:translate-x-[5px] hover:border-sentinel-lime/80"
            }`}
            onMouseEnter={() => setSelected(id)}
            onFocus={() => setSelected(id)}
            style={{ transform: `translateZ(${index * 4}px)` }}
          >
            <Icon className="w-[27px] text-sentinel-muted" aria-hidden="true" />
            <span className="grid gap-[5px]"><strong className="text-xs font-semibold">{label}</strong><small className="text-[10px] text-sentinel-muted before:mr-1.5 before:inline-block before:h-1.5 before:w-1.5 before:rounded-full before:bg-sentinel-amber before:content-['']">{risk}</small></span>
            <i className="absolute right-[-5px] top-[calc(50%-4px)] h-2 w-2 rounded-full bg-sentinel-lime shadow-[0_0_12px_rgba(183,243,74,0.7)]" />
          </button>
        ))}
      </div>
      <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full overflow-visible [&_path]:animate-dash-flow [&_path]:fill-none [&_path]:stroke-sentinel-lime/70 [&_path]:[stroke-dasharray:5_7] [&_path]:[stroke-width:1.5]" viewBox="0 0 1000 650" preserveAspectRatio="none" aria-hidden="true">
        <path d="M290 143 C390 143 350 274 430 274" />
        <path d="M290 244 C385 244 365 292 430 292" />
        <path d="M290 345 C385 345 365 310 430 310" />
        <path d="M290 446 C390 446 350 328 430 328" />
        <path d="M660 283 C720 283 710 208 758 208" />
        <path d="M660 301 C725 301 715 293 758 293" />
        <path d="M660 319 C720 319 710 378 758 378" />
      </svg>
      <div className="absolute left-[43%] top-[225px] z-[4] aspect-square w-[23%] [transform-style:preserve-3d] [transform:translateZ(48px)]">
        <div className="absolute inset-[6%] translate-x-2.5 translate-y-[22px] border border-sentinel-lime/30 bg-sentinel-raised shadow-[0_28px_45px_rgba(0,0,0,0.5)] [clip-path:polygon(50%_0,93%_25%,93%_75%,50%_100%,7%_75%,7%_25%)]" />
        <div className="absolute inset-0 grid place-items-center content-center gap-[9px] border border-sentinel-lime/70 bg-[radial-gradient(circle_at_50%_30%,rgba(183,243,74,0.1),transparent_34%),linear-gradient(145deg,#1a242e,#0a0f13)] [clip-path:polygon(50%_0,93%_25%,93%_75%,50%_100%,7%_75%,7%_25%)]">
          <ShieldCheck className="h-[43px] w-[43px] text-sentinel-lime [stroke-width:1.4]" aria-hidden="true" />
          <strong className="text-[15px]">SentinelOps</strong>
          <span className="font-mono text-[9px] uppercase text-sentinel-lime">Enforcement gateway</span>
        </div>
      </div>
      <div className="absolute right-[3.2%] top-[173px] z-[3] grid w-[21%] gap-[15px] [&>div]:flex [&>div]:min-h-[70px] [&>div]:items-center [&>div]:gap-[9px] [&>div]:rounded-[5px] [&>div]:border [&>div]:bg-[#0b1015]/90 [&>div]:px-[13px] [&>div]:text-[11px] [&>div]:font-semibold [&_svg]:w-[19px]">
        <div className="border-sentinel-lime/50 text-sentinel-lime"><Check /> Allow</div>
        <div className="border-sentinel-amber/60 text-sentinel-amber"><UserRoundCheck /> Human approval</div>
        <div className="border-sentinel-red/60 text-sentinel-red"><X /> Block</div>
      </div>
      <div className="absolute right-1/4 top-6 z-[6] grid w-[280px] grid-cols-[42px_1fr] gap-[11px] rounded-md border border-[#48545f] bg-[#0f151b]/90 p-[13px] shadow-[0_18px_50px_rgba(0,0,0,0.32)] backdrop-blur-xl max-xl:right-[21%] max-xl:w-[230px]">
        <span className="grid h-[42px] w-[42px] place-items-center rounded border border-sentinel-line text-sentinel-lime [&_svg]:w-[21px]"><Bot aria-hidden="true" /></span>
        <div className="grid content-center gap-[3px]">
          <strong className="text-xs">{selectedAgent.label}</strong>
          <small className="text-[10px] text-sentinel-muted">Finance Operations</small>
        </div>
        <dl className="col-span-full mt-[3px]">
          <div className="grid grid-cols-[55px_1fr] border-t border-sentinel-line py-[7px] text-[9px]"><dt className="text-sentinel-muted">Risk</dt><dd className="m-0 text-right">{selectedAgent.risk}</dd></div>
          <div className="grid grid-cols-[55px_1fr] border-t border-sentinel-line py-[7px] text-[9px]"><dt className="text-sentinel-muted">Action</dt><dd className="m-0 text-right">Transfer vendor funds</dd></div>
        </dl>
      </div>
    </div>
  );
}
