"use client";

import {
  Bot,
  Braces,
  Code2,
  Database,
  Headphones,
  Landmark,
  Search,
  ServerCog,
  ShieldCheck,
  Users,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { DiagramNode, RiskBadge, TechnicalCard } from "./ui";

const agents = [
  { id: "finance", label: "Finance Agent", icon: Landmark, risk: "High", owner: "Finance Operations", tools: "ERP · Payments" },
  { id: "release", label: "Release Agent", icon: Code2, risk: "High", owner: "Platform Engineering", tools: "GitHub · Kubernetes" },
  { id: "support", label: "Support Agent", icon: Headphones, risk: "Low", owner: "Customer Operations", tools: "Zendesk · CRM" },
  { id: "hr", label: "HR Agent", icon: Users, risk: "Medium", owner: "People Operations", tools: "HRIS · Documents" },
  { id: "research", label: "Research Agent", icon: Search, risk: "Low", owner: "Strategy", tools: "Web · Documents" },
  { id: "data", label: "Data Agent", icon: Database, risk: "Medium", owner: "Finance Operations", tools: "Snowflake · S3" },
] as const;

type AgentId = (typeof agents)[number]["id"];

export function AgentTopology() {
  const [selectedId, setSelectedId] = useState<AgentId>("data");
  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[5];
  const SelectedIcon = selected.icon;

  return (
    <TechnicalCard className="relative mt-[54px] min-h-[610px] overflow-hidden p-[38px] shadow-[0_30px_90px_rgba(0,0,0,0.28)] max-lg:grid max-lg:min-h-0 max-lg:grid-cols-1 max-lg:gap-6 max-lg:p-7 max-[760px]:mt-9 max-[760px]:p-3.5">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(145,163,179,0.042)_1px,transparent_1px),linear-gradient(90deg,rgba(145,163,179,0.042)_1px,transparent_1px)] bg-[length:36px_36px] [mask-image:radial-gradient(circle_at_50%_50%,black,transparent_82%)] max-lg:hidden" aria-hidden="true" />
      <div className="absolute left-[2.7%] top-20 z-[3] grid w-[15.4%] content-center gap-2.5 max-lg:static max-lg:w-auto max-lg:grid-cols-2 max-lg:content-start max-[760px]:gap-[7px]">
        {agents.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className={`grid min-h-[58px] grid-cols-[28px_1fr_19px] items-center gap-2.5 rounded border bg-gradient-to-r from-sentinel-soft to-[#0c1116] px-3 text-left transition hover:translate-x-1 hover:border-sentinel-lime max-[760px]:min-h-[54px] max-[760px]:grid-cols-[24px_1fr] max-[760px]:px-2 [&_svg]:w-[19px] [&_svg]:text-sentinel-lime [&_svg:last-child]:w-4 [&_svg:last-child]:text-sentinel-muted max-[760px]:[&_svg:last-child]:hidden [&_span]:text-[11px] ${
              selectedId === id
                ? "translate-x-1 border-sentinel-lime bg-gradient-to-r from-sentinel-lime/10 to-[#0c1116]"
                : "border-sentinel-line"
            }`}
            onClick={() => setSelectedId(id)}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <ShieldCheck aria-hidden="true" />
          </button>
        ))}
      </div>
      <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full max-lg:hidden [&_path]:animate-dash-flow [&_path]:fill-none [&_path]:stroke-sentinel-lime/70 [&_path]:[stroke-dasharray:5_7] [&_path]:[stroke-width:1.5]" viewBox="0 0 1400 610" preserveAspectRatio="none" aria-hidden="true">
        <path d="M253.4 109 C370 109 390 236 519 236" />
        <path d="M253.4 177 C375 177 385 250 496 250" />
        <path d="M253.4 245 C380 245 380 264 487 264" />
        <path d="M253.4 313 C380 313 380 278 487 278" />
        <path d="M253.4 381 C375 381 385 292 487 292" />
        <path d="M253.4 449 C370 449 390 306 496 306" />
        <path d="M633 250 C735 250 748 126 826 126" />
        <path d="M643 271 C745 271 748 222 826 222" />
        <path d="M643 292 C735 292 748 318 826 318" />
      </svg>
      <div className="absolute left-[34%] top-[208px] z-[3] grid h-[194px] w-[12.7%] min-w-[150px] place-items-center content-center gap-2 border border-sentinel-lime bg-[radial-gradient(circle,rgba(183,243,74,0.12),transparent_55%)] bg-[#10171d] drop-shadow-[0_20px_24px_rgba(0,0,0,0.4)] [clip-path:polygon(50%_0,94%_25%,94%_75%,50%_100%,6%_75%,6%_25%)] max-lg:static max-lg:mx-auto max-lg:h-[170px] max-lg:w-[156px] max-lg:min-w-0 max-[760px]:my-[18px] max-[760px]:h-[148px] max-[760px]:w-[135px]">
        <ShieldCheck className="h-[42px] w-[42px] text-sentinel-lime" aria-hidden="true" />
        <strong className="text-base">SentinelOps</strong>
        <small className="font-mono text-[8px] uppercase text-sentinel-lime">Control plane</small>
      </div>
      <div className="absolute left-[59%] top-[94px] z-[3] grid w-[13.6%] gap-8 max-lg:static max-lg:grid-cols-3 max-lg:w-auto max-lg:gap-2">
        <DiagramNode icon={<ServerCog />} label="MCP servers" />
        <DiagramNode icon={<Braces />} label="Enterprise APIs" />
        <DiagramNode icon={<Database />} label="Data stores" active />
      </div>
      <aside className="absolute right-[2.7%] top-[120px] z-[3] min-h-[370px] w-[20%] overflow-hidden rounded-2xl border border-[#53606b] bg-sentinel-raised/95 shadow-[-20px_28px_60px_rgba(0,0,0,0.28)] backdrop-blur-lg max-lg:static max-lg:w-auto max-lg:min-h-0">
        <header className="flex items-center gap-[13px] border-b border-sentinel-line p-5">
          <span className="grid h-12 w-12 place-items-center rounded-[5px] border border-sentinel-lime text-sentinel-lime [&_svg]:w-6"><SelectedIcon /></span>
          <div className="grid gap-[7px]"><h3 className="m-0 text-base font-medium">{selected.label}</h3><RiskBadge level={selected.risk} /></div>
        </header>
        <dl className="m-0 px-5 py-2 max-lg:grid max-lg:grid-cols-2 max-[760px]:grid-cols-1">
          <div className="grid min-h-16 grid-cols-[95px_1fr] items-center border-b border-sentinel-line"><dt className="flex items-center gap-[7px] font-mono text-[9px] text-sentinel-muted [&_svg]:w-3.5"><Bot /> Owner</dt><dd className="m-0 text-right text-[10px]">{selected.owner}</dd></div>
          <div className="grid min-h-16 grid-cols-[95px_1fr] items-center border-b border-sentinel-line"><dt className="flex items-center gap-[7px] font-mono text-[9px] text-sentinel-muted [&_svg]:w-3.5"><Braces /> Model</dt><dd className="m-0 text-right text-[10px]">OpenAI</dd></div>
          <div className="grid min-h-16 grid-cols-[95px_1fr] items-center border-b border-sentinel-line"><dt className="flex items-center gap-[7px] font-mono text-[9px] text-sentinel-muted [&_svg]:w-3.5"><Wrench /> Tools</dt><dd className="m-0 text-right text-[10px]">{selected.tools}</dd></div>
          <div className="grid min-h-16 grid-cols-[95px_1fr] items-center border-b border-sentinel-line"><dt className="flex items-center gap-[7px] font-mono text-[9px] text-sentinel-muted [&_svg]:w-3.5"><ShieldCheck /> Permissions</dt><dd className="m-0 text-right text-[10px]">Read · Execute</dd></div>
        </dl>
      </aside>
    </TechnicalCard>
  );
}
