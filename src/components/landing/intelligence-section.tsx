import {
  ArrowRight,
  Building2,
  Cloud,
  CloudCog,
  FileCheck2,
  Globe2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { AgentTopology } from "./agent-topology";
import { Reveal } from "./reveal";
import { SectionHeader } from "./ui";

const policyStages = [
  { label: "Identity", detail: "Finance Agent", icon: UserRound },
  { label: "Context", detail: "Production", icon: Globe2 },
  { label: "Policy", detail: "FIN-07", icon: FileCheck2 },
  { label: "Decision", detail: "Human approval", icon: ShieldCheck },
] as const;

const deploymentOptions = [
  { label: "Cloud", detail: "Fastest path to production", icon: Cloud },
  { label: "Private cloud", detail: "Inside your isolated environment", icon: CloudCog },
  { label: "Customer-managed", detail: "Your keys, network, and controls", icon: LockKeyhole },
] as const;

export function IntelligenceSection() {
  return (
    <>
      <section className="relative border-t border-[#38434e]/45 bg-[radial-gradient(circle_at_42%_55%,rgba(50,73,89,0.13),transparent_40%)] bg-sentinel-canvas px-[max(28px,calc((100vw-1420px)/2))] py-[clamp(90px,10vw,150px)] max-[760px]:px-3.5 max-[760px]:py-[78px]">
        <Reveal>
          <SectionHeader
            title="See every agent. Understand every connection."
            description="Map ownership, models, tools, data paths, and permissions across your entire agent estate."
          />
          <AgentTopology />
        </Reveal>
      </section>

      <section className="relative border-t border-sentinel-line bg-sentinel-surface px-[max(28px,calc((100vw-1420px)/2))] py-[clamp(80px,8vw,120px)] max-[760px]:px-3.5 max-[760px]:py-[78px]">
        <Reveal>
          <SectionHeader
            title="Policy becomes an execution decision."
            description="Evaluate the complete business context at the moment an agent attempts to act."
          />
          <div className="relative mt-[60px] grid grid-cols-4 before:absolute before:left-[5%] before:right-[5%] before:top-[29px] before:h-px before:bg-sentinel-lime before:content-[''] max-[760px]:mt-10 max-[760px]:grid-cols-1 max-[760px]:gap-3.5 max-[760px]:before:bottom-[5%] max-[760px]:before:left-[29px] max-[760px]:before:right-auto max-[760px]:before:top-[5%] max-[760px]:before:h-auto max-[760px]:before:w-px">
            {policyStages.map(({ label, detail, icon: Icon }, index) => (
              <div className="relative z-[2] grid grid-cols-[60px_1fr_20px] items-center gap-3.5 pr-5 max-[760px]:pr-0" key={label}>
                <span className="grid h-[60px] w-[60px] place-items-center rounded-full border border-sentinel-lime bg-sentinel-canvas text-sentinel-lime [&_svg]:w-6"><Icon aria-hidden="true" /></span>
                <div className="grid gap-1.5"><strong className="font-mono text-xs text-sentinel-lime">{label}</strong><small className="text-[11px] text-sentinel-muted">{detail}</small></div>
                {index < policyStages.length - 1 ? <ArrowRight className="w-4 text-sentinel-lime max-[760px]:rotate-90" aria-hidden="true" /> : null}
              </div>
            ))}
          </div>
          <div className="mt-[35px] grid grid-cols-4 border-y border-sentinel-line py-6 max-[760px]:grid-cols-2 max-[760px]:gap-y-[18px] [&>span]:grid [&>span]:gap-2 [&>span]:border-r [&>span]:border-sentinel-line [&>span]:px-[23px] [&>span]:font-mono [&>span]:text-[9px] [&>span]:uppercase [&>span]:tracking-[0.08em] [&>span]:text-sentinel-muted [&>span:first-child]:pl-0 [&>span:last-child]:border-0 [&_strong]:text-xs [&_strong]:normal-case [&_strong]:tracking-normal [&_strong]:text-sentinel-text max-[760px]:[&>span]:border-0 max-[760px]:[&>span]:p-0">
            <span>Action <strong>payments.transfer</strong></span>
            <span>Amount <strong>$250,000</strong></span>
            <span>Environment <strong>Production</strong></span>
            <span>Policy <strong>FIN-07</strong></span>
          </div>
        </Reveal>
      </section>

      <section className="relative border-t border-sentinel-line bg-[linear-gradient(90deg,rgba(56,189,248,0.03),transparent_32%)] bg-sentinel-canvas px-[max(28px,calc((100vw-1420px)/2))] py-[65px] max-[760px]:px-3.5" id="deployments">
        <Reveal className="grid grid-cols-[0.78fr_1.22fr] items-center gap-[70px] max-lg:grid-cols-1 max-[760px]:gap-[38px]">
          <div>
            <Building2 className="h-7 w-7 text-sentinel-lime" aria-hidden="true" />
            <h2 className="mt-5 max-w-[500px] text-[clamp(31px,3vw,48px)] font-medium leading-[1.08] tracking-[-0.055em]">Enforcement stays close to the workload.</h2>
            <p className="mt-3.5 leading-[1.6] text-sentinel-muted">Choose the deployment boundary that matches your security model.</p>
          </div>
          <div className="grid grid-cols-3 border-y border-sentinel-line max-[760px]:grid-cols-1">
            {deploymentOptions.map(({ label, detail, icon: Icon }) => (
              <article className="flex min-h-32 items-center gap-3.5 border-r border-sentinel-line p-[18px] last:border-r-0 max-[760px]:min-h-[94px] max-[760px]:border-b max-[760px]:border-r-0 max-[760px]:last:border-b-0" key={label}>
                <Icon className="w-7 text-sentinel-lime [stroke-width:1.5]" aria-hidden="true" />
                <div><h3 className="m-0 font-mono text-xs font-medium">{label}</h3><p className="mt-[7px] text-[9px] leading-normal text-sentinel-muted">{detail}</p></div>
              </article>
            ))}
          </div>
        </Reveal>
      </section>
    </>
  );
}
