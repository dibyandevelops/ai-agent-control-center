import { ClipboardCheck, FileCheck2, ScanSearch } from "lucide-react";
import { ApprovalDemo } from "./approval-demo";
import { Reveal } from "./reveal";
import { SectionHeader } from "./ui";

const workflow = [
  {
    index: "01",
    label: "Register",
    title: "Know every agent",
    body: "Capture ownership, model, purpose, tools, and permission scope.",
    icon: ScanSearch,
  },
  {
    index: "02",
    label: "Enforce",
    title: "Decide before execution",
    body: "Evaluate identity, context, policy, and risk before a tool call runs.",
    icon: ClipboardCheck,
  },
  {
    index: "03",
    label: "Prove",
    title: "Keep durable evidence",
    body: "Record the request, decision, approver, and final outcome.",
    icon: FileCheck2,
  },
] as const;

export function WorkflowSection() {
  return (
    <>
      <section className="relative border-t border-[#38434e]/45 px-[max(28px,calc((100vw-1420px)/2))] py-[clamp(90px,10vw,150px)] max-[760px]:px-3.5 max-[760px]:py-[78px]" id="product">
        <Reveal>
          <SectionHeader
            title="The control plane for autonomous work."
            description="SentinelOps sits between AI agents and critical systems—turning organizational policy into an execution decision."
          />
          <ol className="relative mt-[74px] grid list-none grid-cols-3 gap-0 p-0 before:absolute before:left-[4%] before:right-[4%] before:top-[31px] before:h-px before:bg-gradient-to-r before:from-sentinel-lime before:to-sentinel-lime/20 before:content-[''] max-lg:gap-8 max-[760px]:mt-[50px] max-[760px]:grid-cols-1 max-[760px]:gap-0 max-[760px]:before:bottom-0 max-[760px]:before:left-[27px] max-[760px]:before:right-auto max-[760px]:before:top-0 max-[760px]:before:h-auto max-[760px]:before:w-px">
            {workflow.map(({ index, label, title, body, icon: Icon }) => (
              <li className="relative grid grid-cols-[66px_1fr] gap-[18px] pr-[42px] max-lg:grid-cols-[56px_1fr] max-lg:pr-0 max-[760px]:min-h-[170px]" key={label}>
                <span className="absolute -top-[27px] left-[78px] font-mono text-[10px] text-sentinel-dim max-[760px]:-top-4 max-[760px]:left-[74px]">{index}</span>
                <Icon className="z-[2] h-[62px] w-[62px] rounded-full border border-sentinel-lime/70 bg-sentinel-canvas p-[17px] text-sentinel-lime [stroke-width:1.35] max-lg:h-[54px] max-lg:w-[54px] max-lg:p-[15px]" aria-hidden="true" />
                <div>
                  <strong className="mt-[9px] block text-[13px] uppercase tracking-[0.12em] text-sentinel-lime">{label}</strong>
                  <h3 className="mt-[13px] text-[clamp(20px,1.8vw,27px)] font-medium tracking-[-0.035em]">{title}</h3>
                  <p className="mt-3 max-w-[330px] text-[13px] leading-[1.7] text-sentinel-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </section>
      <section className="relative border-t border-[#38434e]/45 bg-[radial-gradient(circle_at_85%_50%,rgba(183,243,74,0.035),transparent_28%)] bg-sentinel-deep px-[max(22px,calc((100vw-1480px)/2))] py-[clamp(90px,9vw,140px)] max-[760px]:px-2.5 max-[760px]:py-[78px]" id="workflow">
        <Reveal>
          <SectionHeader
            title="A decision boundary for every consequential action."
            description="SentinelOps evaluates identity, business context, policy, and risk before execution."
          />
          <ApprovalDemo />
        </Reveal>
      </section>
    </>
  );
}
