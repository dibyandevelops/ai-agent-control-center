import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Brand } from "./brand";
import { Reveal } from "./reveal";

export function LandingFooter() {
  return (
    <>
      <section className="relative min-h-[420px] overflow-hidden border-y border-sentinel-line bg-[linear-gradient(rgba(56,189,248,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(56,189,248,0.03)_1px,transparent_1px),radial-gradient(circle_at_80%_100%,rgba(56,189,248,0.06),transparent_32%)] bg-[length:48px_48px,48px_48px,auto] bg-sentinel-surface max-[760px]:min-h-[490px]" id="contact">
        <Reveal className="grid min-h-[420px] place-items-center content-center px-6 py-[60px] text-center max-[760px]:min-h-[490px]">
          <h2 className="m-0 max-w-[980px] font-mono text-[clamp(40px,4.8vw,68px)] font-medium leading-[1.08] tracking-[-0.055em] max-[760px]:text-[clamp(37px,10vw,50px)]">Put your AI workforce on a shorter leash.</h2>
          <p className="mt-[21px] text-[17px] text-sentinel-muted max-[760px]:text-sm max-[760px]:leading-[1.6]">Start with one high-risk workflow. Expand as your agent estate grows.</p>
          <div className="mt-8 flex gap-3.5 max-[760px]:grid max-[760px]:w-full max-[760px]:max-w-[420px]">
            <a href="mailto:cs@sentinelops-ai.com" className="inline-flex min-h-[54px] min-w-[230px] items-center justify-center gap-[22px] rounded-full border border-sentinel-lime bg-sentinel-lime px-[27px] text-sm font-bold text-[#091004] transition hover:-translate-y-0.5 max-[760px]:min-w-0 [&_svg]:w-[17px]">
              Book a demo <ArrowUpRight />
            </a>
            <Link href="/dashboard" className="inline-flex min-h-[54px] min-w-[230px] items-center justify-center gap-[22px] rounded-full border border-sentinel-lime bg-sentinel-surface/80 px-[27px] text-sm font-bold transition hover:-translate-y-0.5 hover:bg-sentinel-lime/10 max-[760px]:min-w-0 [&_svg]:w-[17px]">
              Open control center <ArrowUpRight />
            </Link>
          </div>
        </Reveal>
      </section>
      <footer className="mx-auto grid min-h-[330px] max-w-[1420px] grid-cols-[1.3fr_1fr] gap-[90px] px-[max(28px,4vw)] pb-7 pt-[65px] max-[760px]:grid-cols-1 max-[760px]:gap-[45px] max-[760px]:px-6">
        <div>
          <Brand footer />
          <p className="mt-[27px] max-w-[310px] border-t border-sentinel-line pt-[22px] text-[13px] text-sentinel-muted">Enterprise control for autonomous work.</p>
        </div>
        <div className="grid grid-cols-2 gap-[70px] [&>div]:grid [&>div]:content-start [&>div]:gap-[13px] [&_strong]:w-max [&_strong]:border-b-2 [&_strong]:border-sentinel-lime [&_strong]:pb-2 [&_strong]:font-mono [&_strong]:text-[11px] [&_a]:w-max [&_a]:text-xs [&_a]:text-sentinel-muted [&_a]:transition-colors [&_a:hover]:text-sentinel-lime">
          <div>
            <strong>Product</strong>
            <a href="#product">Overview</a>
            <a href="#workflow">Workflow</a>
            <a href="#security">Security</a>
            <a href="#deployments">Deployments</a>
          </div>
          <div>
            <strong>Company</strong>
            <a href="mailto:cs@sentinelops-ai.com">Contact</a>
            <Link href="/dashboard">Control center</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/security">Security</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/refund-policy">Refund & cancellation</Link>
          </div>
        </div>
        <span className="col-span-full self-end border-t border-sentinel-line pt-5 text-[10px] text-sentinel-dim max-[760px]:col-auto">© 2026 SentinelOps</span>
      </footer>
    </>
  );
}
