import {
  ArrowDown,
  Bot,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Fingerprint,
  ShieldCheck,
  UserRoundCheck,
  X,
} from "lucide-react";
import { Reveal } from "./reveal";
import { SectionHeader } from "./ui";

const principles = [
  {
    index: "01",
    title: "Least-privilege permissions",
    body: "Give every agent only the data and actions it needs.",
    icon: ShieldCheck,
  },
  {
    index: "02",
    title: "Human approval for consequential actions",
    body: "Keep people accountable at the moments that matter.",
    icon: UserRoundCheck,
  },
  {
    index: "03",
    title: "Evidence by default",
    body: "Preserve every request, decision, approver, and outcome.",
    icon: ClipboardCheck,
  },
] as const;

const layers = [
  { label: "Identity", detail: "Users, teams, agents, service identities", icon: Fingerprint },
  { label: "Policy", detail: "Actions, data, context, risk, guardrails", icon: ShieldCheck },
  { label: "Audit", detail: "Requests, decisions, approvals, outcomes", icon: ClipboardCheck },
  { label: "Cost controls", detail: "Budgets, rate limits, spend guardrails", icon: CircleDollarSign },
] as const;

const controls = [
  "SOC 2 ready controls",
  "ISO 27001 mapping",
  "GDPR data controls",
  "SSO / SAML",
  "SCIM",
  "RBAC / ABAC",
] as const;

export function SecuritySection() {
  return (
    <section className="relative border-t border-sentinel-line bg-sentinel-canvas px-[max(28px,calc((100vw-1420px)/2))] py-[clamp(90px,10vw,150px)] max-[760px]:px-3.5 max-[760px]:py-[78px]" id="security">
      <Reveal>
        <div className="grid grid-cols-[0.9fr_1.1fr] overflow-hidden rounded-3xl border border-sentinel-line bg-sentinel-surface shadow-app-1 max-lg:grid-cols-1">
          <div className="border-r border-sentinel-line p-[50px] max-lg:border-b max-lg:border-r-0 max-[760px]:p-[28px_18px] [&_h2]:font-mono [&_h2]:text-[clamp(34px,3.2vw,50px)] [&_h2]:tracking-[-0.045em]">
            <SectionHeader title="Control without slowing teams down." />
            <div className="mt-[39px]">
              {principles.map(({ index, title, body, icon: Icon }) => (
                <article className="grid min-h-28 grid-cols-[50px_34px_1fr] items-center gap-3.5 border-t border-sentinel-line max-[760px]:min-h-[134px] max-[760px]:grid-cols-[38px_25px_1fr]" key={title}>
                  <Icon className="w-[33px] text-sentinel-text [stroke-width:1.3]" aria-hidden="true" />
                  <span className="font-mono text-[9px] text-sentinel-lime">{index}</span>
                  <div><h3 className="m-0 font-mono text-sm font-medium max-[760px]:text-xs max-[760px]:leading-normal">{title}</h3><p className="mt-2 text-[11px] text-sentinel-muted">{body}</p></div>
                </article>
              ))}
            </div>
          </div>
          <div className="grid content-center p-[45px] max-[760px]:p-[28px_18px]">
            <span className="mb-[18px] font-mono text-[11px] uppercase tracking-[0.1em] text-emerald-700 dark:text-sentinel-lime font-bold">Enforcement boundary</span>
            <div className="mx-auto flex min-h-[54px] w-[58%] items-center justify-center gap-2.5 rounded-xl border border-sentinel-line bg-sentinel-surface text-xs text-sentinel-text shadow-sm max-[760px]:w-full [&_svg]:w-[18px]"><Bot /> Agent request</div>
            <ArrowDown className="mx-auto my-[7px] w-4 text-sentinel-muted" />
            <div className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-xl border border-emerald-500/50 dark:border-sentinel-lime bg-emerald-500/10 dark:bg-sentinel-lime/10 text-xs font-semibold text-emerald-700 dark:text-sentinel-lime shadow-sm [&_svg]:w-[18px]"><ShieldCheck /> SentinelOps gateway</div>
            <div className="mt-[17px] grid grid-cols-3 gap-2.5 max-[760px]:grid-cols-1 [&>span]:flex [&>span]:min-h-12 [&>span]:items-center [&>span]:justify-center [&>span]:gap-2 [&>span]:rounded-xl [&>span]:border [&>span]:text-[10px] [&>span]:font-bold [&_svg]:w-4">
              <span className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-sentinel-lime"><Check /> Allow</span>
              <span className="border-sentinel-amber/40 bg-sentinel-amber/10 text-amber-700 dark:text-sentinel-amber"><UserRoundCheck /> Human approval</span>
              <span className="border-sentinel-red/40 bg-sentinel-red/10 text-red-700 dark:text-sentinel-red"><X /> Block</span>
            </div>
            <div className="mt-7 grid">
              {layers.map(({ label, detail, icon: Icon }) => (
                <div className="grid min-h-12 grid-cols-[26px_95px_1fr] items-center border-t border-sentinel-line max-[760px]:grid-cols-[25px_78px_1fr]" key={label}>
                  <Icon className="w-4 text-emerald-600 dark:text-sentinel-lime" aria-hidden="true" />
                  <strong className="text-[10px] text-sentinel-text">{label}</strong>
                  <span className="text-[9px] text-sentinel-muted">{detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 grid min-h-[78px] grid-cols-[1.5fr_repeat(6,auto)] items-center rounded-2xl border border-sentinel-line-strong bg-sentinel-surface/90 max-xl:grid-cols-3 max-xl:p-3 max-[760px]:grid-cols-2 [&>strong]:flex [&>strong]:min-h-[37px] [&>strong]:items-center [&>strong]:border-r [&>strong]:border-sentinel-line [&>strong]:px-[22px] [&>strong]:font-mono [&>strong]:text-xs [&>strong]:before:mr-3 [&>strong]:before:h-[5px] [&>strong]:before:w-[5px] [&>strong]:before:-rotate-45 [&>strong]:before:border-b [&>strong]:before:border-r [&>strong]:before:border-sentinel-lime [&>strong]:before:content-[''] max-xl:[&>strong]:border-0 max-[760px]:[&>strong]:col-span-full [&>span]:flex [&>span]:min-h-[37px] [&>span]:items-center [&>span]:whitespace-nowrap [&>span]:border-r [&>span]:border-sentinel-line [&>span]:px-[22px] [&>span]:font-mono [&>span]:text-[8px] [&>span]:text-sentinel-muted [&>span]:before:mr-3 [&>span]:before:h-[5px] [&>span]:before:w-[5px] [&>span]:before:-rotate-45 [&>span]:before:border-b [&>span]:before:border-r [&>span]:before:border-sentinel-lime [&>span]:before:content-[''] max-xl:[&>span]:border-0">
          <strong>Enterprise-ready controls</strong>
          {controls.map((control) => <span key={control}>{control}</span>)}
        </div>
      </Reveal>
    </section>
  );
}
