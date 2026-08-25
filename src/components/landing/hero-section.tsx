import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Bot,
  Braces,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ShieldCheck,
  UserRoundCheck,
  Users,
  X,
} from "lucide-react";
import { HeroVisualLoader } from "./hero-visual-loader";

const audiences = [
  { label: "Security", icon: ShieldCheck },
  { label: "AI Ops", icon: Braces },
  { label: "Compliance", icon: ClipboardCheck },
  { label: "Platform Teams", icon: Users },
] as const;

export function HeroSection() {
  return (
    <section className="relative isolate mx-auto grid min-h-[min(940px,100svh)] max-w-[1540px] grid-cols-[minmax(380px,0.78fr)_minmax(590px,1.22fr)] items-center gap-[clamp(20px,3.2vw,60px)] px-[clamp(28px,4vw,64px)] pb-[92px] pt-[126px] max-xl:grid-cols-[0.75fr_1.25fr] max-xl:px-7 max-lg:min-h-0 max-lg:grid-cols-1 max-lg:pt-[145px] max-[760px]:px-3.5 max-[760px]:pb-[70px] max-[760px]:pt-32">
      <div className="absolute -inset-x-[10vw] inset-y-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px),radial-gradient(circle_at_76%_38%,rgba(183,243,74,0.07),transparent_22%),radial-gradient(circle_at_48%_44%,rgba(37,59,77,0.1),transparent_32%)] bg-[length:56px_56px,56px_56px,auto,auto] [mask-image:linear-gradient(to_bottom,transparent_0,#000_13%,#000_82%,transparent)] max-[760px]:bg-[length:36px_36px,36px_36px,auto,auto]" aria-hidden="true" />
      <div className="relative z-[3] pb-[34px] max-lg:max-w-[760px]">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 dark:border-sentinel-lime/30 bg-emerald-500/10 dark:bg-sentinel-lime/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-sentinel-lime mb-6 shadow-sm">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 dark:bg-sentinel-lime opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 dark:bg-sentinel-lime" />
          </span>
          <span>SentinelOps v2.4 · Zero-Trust AI Agent Governance</span>
        </div>

        <h1 className="m-0 max-w-[660px] text-[clamp(58px,5.35vw,90px)] font-black leading-[0.96] tracking-[-0.065em] max-xl:text-[clamp(52px,5vw,68px)] max-[760px]:text-[clamp(47px,14vw,65px)] max-[760px]:leading-[0.99]">
          Every AI agent.
          <br />
          Every action.
          <br />
          <span className="text-emerald-600 dark:text-sentinel-lime">Under control.</span>
        </h1>
        <p className="mt-[34px] max-w-[590px] text-[clamp(16px,1.25vw,20px)] leading-[1.65] text-sentinel-muted max-[760px]:mt-[26px] max-[760px]:text-[15px]">
          Discover every agent, enforce policy before execution, route
          consequential actions for human approval, and preserve audit-ready
          evidence.
        </p>
        <div className="mt-[34px] flex items-center gap-4 max-[760px]:mt-[27px] max-[760px]:grid">
          <Link href="/get-started" className="inline-flex min-h-[54px] items-center justify-center gap-[22px] whitespace-nowrap rounded-full border border-emerald-500 dark:border-sentinel-lime bg-emerald-500 dark:bg-sentinel-lime px-[27px] text-sm font-bold text-white dark:text-[#091004] shadow-md transition hover:-translate-y-0.5 max-[760px]:w-full max-[760px]:min-h-[52px] [&_svg]:h-[17px] [&_svg]:w-[17px]">
            Create workspace <ArrowUpRight aria-hidden="true" />
          </Link>
          <Link href="/dashboard" className="inline-flex min-h-[54px] items-center justify-center gap-[22px] whitespace-nowrap rounded-full border border-sentinel-line bg-sentinel-surface px-[27px] text-sm font-bold text-sentinel-text transition hover:-translate-y-0.5 hover:border-emerald-600 dark:hover:border-sentinel-lime hover:bg-sentinel-surface-raised max-[760px]:w-full max-[760px]:min-h-[52px] [&_svg]:h-[17px] [&_svg]:w-[17px]">
            Explore control center <ArrowUpRight aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-10 flex flex-wrap text-sentinel-muted max-[760px]:mt-[30px] max-[760px]:grid max-[760px]:grid-cols-2 max-[760px]:gap-y-4 [&_span]:inline-flex [&_span]:items-center [&_span]:gap-2 [&_span]:whitespace-nowrap [&_span]:border-r [&_span]:border-sentinel-line [&_span]:px-3 [&_span]:text-xs [&_span:first-child]:pl-0 [&_span:last-child]:border-0 [&_svg]:h-[17px] [&_svg]:w-[17px] [&_svg]:text-sentinel-lime [&_svg]:[stroke-width:1.5] max-[760px]:[&_span]:border-0 max-[760px]:[&_span]:p-0" aria-label="Built for enterprise teams">
          {audiences.map(({ label, icon: Icon }) => (
            <span key={label}>
              <Icon aria-hidden="true" /> {label}
            </span>
          ))}
        </div>
      </div>
      <div className="relative z-[2] min-w-0 [perspective:1300px] max-lg:mt-2.5 max-[760px]:hidden">
        <HeroVisualLoader />
      </div>
      <div className="mt-4 hidden gap-[9px] rounded-3xl border border-sentinel-line-strong bg-[linear-gradient(rgba(183,243,74,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(183,243,74,0.035)_1px,transparent_1px)] bg-[length:28px_28px] bg-sentinel-surface p-[18px] max-[760px]:grid [&>svg]:mx-auto [&>svg]:w-[15px] [&>svg]:text-sentinel-muted" aria-label="SentinelOps enforcement flow">
        <span className="flex min-h-[52px] items-center justify-center gap-[9px] rounded border border-sentinel-line bg-sentinel-surface/90 text-[11px] [&_svg]:w-[17px]"><Bot aria-hidden="true" /> Agent request</span>
        <ArrowDown aria-hidden="true" />
        <strong className="flex min-h-[52px] items-center justify-center gap-[9px] rounded border border-sentinel-lime bg-sentinel-surface/90 text-[11px] text-sentinel-lime [&_svg]:w-[17px]"><ShieldCheck aria-hidden="true" /> SentinelOps gateway</strong>
        <div className="grid grid-cols-3 gap-1.5">
          <span className="grid min-h-[61px] place-items-center content-center gap-1.5 rounded border border-sentinel-lime/40 bg-sentinel-lime/10 text-[8px] text-sentinel-lime [&_svg]:w-[17px]"><Check aria-hidden="true" /> Allow</span>
          <span className="grid min-h-[61px] place-items-center content-center gap-1.5 rounded border border-sentinel-amber/40 bg-sentinel-amber/10 text-[8px] text-sentinel-amber [&_svg]:w-[17px]"><UserRoundCheck aria-hidden="true" /> Approval</span>
          <span className="grid min-h-[61px] place-items-center content-center gap-1.5 rounded border border-sentinel-red/40 bg-sentinel-red/10 text-[8px] text-sentinel-red [&_svg]:w-[17px]"><X aria-hidden="true" /> Block</span>
        </div>
      </div>
      <div className="absolute bottom-[65px] right-[clamp(35px,5vw,85px)] z-[7] flex items-center gap-[17px] rounded-2xl border border-sentinel-line bg-sentinel-surface/90 px-[18px] py-[13px] text-[10px] text-sentinel-muted shadow-app-1 max-xl:hidden max-lg:bottom-10 max-lg:right-[45px] max-lg:flex max-[760px]:hidden [&>svg]:w-[18px] [&>svg]:text-sentinel-lime [&>strong]:text-[11px] [&>strong]:text-sentinel-text [&>span]:border-l [&>span]:border-sentinel-line [&>span]:pl-3.5">
        <CheckCircle2 aria-hidden="true" />
        <strong>Audit-ready evidence</strong>
        <span>Policy evaluated</span>
        <span>Context captured</span>
        <span>Action recorded</span>
      </div>
    </section>
  );
}
