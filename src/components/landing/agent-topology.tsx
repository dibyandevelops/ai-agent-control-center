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
import { useRef, useState } from "react";
import { DiagramNode, RiskBadge, TechnicalCard } from "./ui";
import { SentinelLogo } from "@/components/brand-logo";

const agents = [
  { id: "finance", label: "Finance Agent", icon: Landmark, risk: "High", owner: "Finance Operations", tools: "ERP · Payments" },
  { id: "support", label: "Support Agent", icon: Headphones, risk: "Low", owner: "Customer Support", tools: "Zendesk · Knowledge base" },
  { id: "data-analyst", label: "Analytics Agent", icon: Search, risk: "Low", owner: "BI Team", tools: "BigQuery · Looker" },
  { id: "lead-qual", label: "SDR Agent", icon: Users, risk: "Low", owner: "Revenue Ops", tools: "HubSpot · Gmail" },
  { id: "security", label: "SecOps Agent", icon: ShieldCheck, risk: "Medium", owner: "InfoSec", tools: "SIEM · AWS CloudTrail" },
  { id: "data", label: "Data Pipeline", icon: Database, risk: "Medium", owner: "Data Platform", tools: "Snowflake · S3" },
  { id: "release", label: "Release Agent", icon: Code2, risk: "High", owner: "DevOps", tools: "GitHub · Terraform" },
  { id: "infra", label: "Infra Agent", icon: Wrench, risk: "High", owner: "SRE", tools: "Kubernetes · Datadog" },
] as const;

type AgentId = (typeof agents)[number]["id"];

export function AgentTopology() {
  const [selectedId, setSelectedId] = useState<AgentId>("data");
  const asideRef = useRef<HTMLElement>(null);
  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[5];
  const SelectedIcon = selected.icon;

  function handleSelectAgent(id: AgentId) {
    setSelectedId(id);
    if (window.innerWidth < 1024 && asideRef.current) {
      asideRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  return (
    <TechnicalCard className="relative mt-[54px] min-h-[610px] overflow-hidden p-[38px] shadow-[0_30px_90px_rgba(0,0,0,0.28)] max-lg:grid max-lg:min-h-0 max-lg:grid-cols-1 max-lg:gap-6 max-lg:p-7 max-[760px]:mt-9 max-[760px]:p-3.5">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(145,163,179,0.042)_1px,transparent_1px),linear-gradient(90deg,rgba(145,163,179,0.042)_1px,transparent_1px)] bg-[length:36px_36px] [mask-image:radial-gradient(circle_at_50%_50%,black,transparent_82%)] max-lg:hidden" aria-hidden="true" />
      <div className="absolute left-[2.7%] top-20 z-[3] grid w-[15.4%] content-center gap-2.5 max-lg:static max-lg:w-auto max-lg:grid-cols-2 max-lg:content-start max-[760px]:gap-[7px]">
        {agents.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            className={`grid min-h-[58px] grid-cols-[28px_1fr_19px] items-center gap-2.5 rounded-xl border bg-sentinel-surface px-3 text-left transition hover:translate-x-1 hover:border-emerald-500 dark:hover:border-sentinel-lime shadow-xs max-[760px]:min-h-[54px] max-[760px]:grid-cols-[24px_1fr] max-[760px]:px-2 [&_svg]:w-[19px] [&_svg]:text-emerald-600 dark:[&_svg]:text-sentinel-lime [&_svg:last-child]:w-4 [&_svg:last-child]:text-sentinel-muted max-[760px]:[&_svg:last-child]:hidden [&_span]:text-[11px] [&_span]:text-sentinel-text ${
              selectedId === id
                ? "translate-x-1 border-emerald-600 dark:border-sentinel-lime bg-emerald-500/10 dark:bg-sentinel-lime/10"
                : "border-sentinel-line"
            }`}
            onClick={() => handleSelectAgent(id)}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
            <ShieldCheck aria-hidden="true" />
          </button>
        ))}
      </div>
      <svg className="pointer-events-none absolute inset-0 z-[1] h-full w-full max-lg:hidden [&_path]:animate-dash-flow [&_path]:fill-none [&_path]:stroke-emerald-600/50 dark:[&_path]:stroke-sentinel-lime/70 [&_path]:[stroke-dasharray:5_7] [&_path]:[stroke-width:1.5]" viewBox="0 0 1400 610" preserveAspectRatio="none" aria-hidden="true">
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
      <div className="absolute left-[34%] top-[208px] z-[3] grid h-[194px] w-[12.7%] min-w-[150px] place-items-center content-center gap-2 border border-emerald-500/50 dark:border-sentinel-lime bg-sentinel-surface shadow-xl [clip-path:polygon(50%_0,94%_25%,94%_75%,50%_100%,6%_75%,6%_25%)] max-lg:static max-lg:mx-auto max-lg:h-[170px] max-lg:w-[156px] max-lg:min-w-0 max-[760px]:my-[18px] max-[760px]:h-[148px] max-[760px]:w-[135px]">
        <SentinelLogo size={42} />
        <strong className="text-base text-sentinel-text">SentinelOps</strong>
        <small className="font-mono text-[8px] uppercase text-emerald-700 dark:text-sentinel-lime">Control plane</small>
      </div>
      <div className="absolute left-[59%] top-[94px] z-[3] grid w-[13.6%] gap-8 max-lg:static max-lg:grid-cols-3 max-lg:w-auto max-lg:gap-2">
        <DiagramNode icon={<ServerCog />} label="MCP servers" />
        <DiagramNode icon={<Braces />} label="Enterprise APIs" />
        <DiagramNode icon={<Database />} label="Data stores" active />
      </div>
      <aside
        ref={asideRef}
        className="absolute right-[2.7%] top-[120px] z-[3] min-h-[370px] w-[20%] overflow-hidden rounded-2xl border border-sentinel-line bg-sentinel-surface p-0 shadow-xl backdrop-blur-lg max-lg:static max-lg:w-auto max-lg:min-h-0 scroll-mt-24"
      >
        <header className="flex items-center gap-[13px] border-b border-sentinel-line p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-emerald-500/50 dark:border-sentinel-lime text-emerald-600 dark:text-sentinel-lime bg-emerald-500/10 dark:bg-sentinel-lime/10 [&_svg]:w-6"><SelectedIcon /></span>
          <div className="grid gap-[7px]"><h3 className="m-0 text-base font-medium text-sentinel-text">{selected.label}</h3><RiskBadge level={selected.risk} /></div>
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
