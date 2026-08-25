"use client";

import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Database,
  Download,
  Landmark,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { RiskBadge } from "./ui";

type Decision = "pending" | "approved" | "denied";
type ScenarioId = "finance" | "data" | "release";

const scenarios = {
  finance: {
    agent: "Finance Agent",
    action: "Transfer vendor funds",
    amount: "$250,000.00",
    owner: "Finance Operations",
    environment: "Production",
    policy: "FIN-07",
    risk: "High",
    outcome: "Human approval",
    icon: Landmark,
    automatic: false,
  },
  data: {
    agent: "Data Agent",
    action: "Export 14,820 financial records",
    amount: "14,820 rows",
    owner: "Finance Operations",
    environment: "Production",
    policy: "DATA-02",
    risk: "Medium",
    outcome: "Human approval",
    icon: Database,
    automatic: false,
  },
  release: {
    agent: "Release Agent",
    action: "Deploy production release",
    amount: "v2.4.1",
    owner: "Platform Engineering",
    environment: "Production",
    policy: "CHG-09",
    risk: "High",
    outcome: "Blocked",
    icon: Code2,
    automatic: true,
  },
} as const;

const baseSteps = [
  "Request received",
  "Identity resolved",
  "Context captured",
  "Policy evaluated",
  "Risk classified",
] as const;

const panelHeader =
  "flex min-h-[52px] items-center justify-between border-b border-sentinel-line bg-sentinel-surface-raised/80 px-5 font-mono text-[10px] uppercase tracking-[0.13em] text-sentinel-muted";
const factRow =
  "grid min-h-12 grid-cols-[1fr_1.2fr] items-center border-b border-sentinel-line/75";
const evidenceRow =
  "grid grid-cols-2 border-t border-sentinel-line py-[7px] text-[9px]";

export function ApprovalDemo() {
  const [activeId, setActiveId] = useState<ScenarioId>("finance");
  const [decision, setDecision] = useState<Decision>("pending");
  const scenario = scenarios[activeId];
  const Icon = scenario.icon;
  const finalDecision = scenario.automatic ? "denied" : decision;

  const steps = useMemo(
    () => [
      ...baseSteps,
      scenario.automatic ? "Policy enforced" : "Human review",
      "Evidence recorded",
    ],
    [scenario.automatic],
  );

  function selectScenario(id: ScenarioId) {
    setActiveId(id);
    setDecision("pending");
  }

  function downloadEvidence() {
    const evidence = {
      requestId: `req-${activeId}-2026-0727`,
      agent: scenario.agent,
      action: scenario.action,
      policy: scenario.policy,
      environment: scenario.environment,
      decision: finalDecision,
      reviewer: finalDecision === "denied" && scenario.automatic ? "SentinelOps policy engine" : "Finance Lead",
    };
    const blob = new Blob([JSON.stringify(evidence, null, 2)], {
      type: "application/json",
    });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${evidence.requestId}.json`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  return (
    <div className="mt-[54px] max-[760px]:mt-9">
      <div className="grid min-h-[600px] grid-cols-[0.86fr_1.28fr_0.96fr] overflow-hidden rounded-3xl border border-sentinel-line-strong bg-sentinel-surface shadow-[0_32px_90px_rgba(0,0,0,0.32)] max-lg:grid-cols-[0.75fr_1.25fr] max-[760px]:grid-cols-1 [&>section]:min-w-0 [&>section]:border-r [&>section]:border-sentinel-line [&>section:last-child]:border-r-0 max-[760px]:[&>section]:border-b max-[760px]:[&>section]:border-r-0">
        <section aria-label="Enforcement timeline">
          <header className={panelHeader}>Event timeline <span className="text-[8px] text-sentinel-lime">Live evaluation</span></header>
          <ol className="m-0 list-none py-3">
            {steps.map((step, index) => {
              const isDecisionStep = index === 5;
              const isPending = isDecisionStep && finalDecision === "pending";
              const isFuture = index === 6 && finalDecision === "pending";
              return (
                <li
                  key={step}
                  className={`relative grid min-h-[73px] grid-cols-[32px_1fr_18px] items-center gap-3 border-b border-sentinel-line/70 py-2 pl-[25px] pr-[18px] before:absolute before:bottom-0 before:left-10 before:top-0 before:w-px before:bg-sentinel-lime/40 before:content-[''] max-[760px]:min-h-16 ${
                    isPending ? "bg-gradient-to-r from-sentinel-lime/10 to-transparent [&_small]:!text-sentinel-lime [&>span]:shadow-[0_0_25px_rgba(183,243,74,0.32)]" : ""
                  } ${isFuture ? "opacity-40" : ""}`}
                >
                  <span className="z-[1] grid h-[31px] w-[31px] place-items-center rounded-full border border-sentinel-lime bg-sentinel-surface font-mono text-[10px] text-sentinel-lime">{index + 1}</span>
                  <div className="grid gap-[5px]">
                    <strong className="text-xs font-medium">{step}</strong>
                    <small className="font-mono text-[9px] uppercase tracking-[0.08em] text-sentinel-dim">
                      {isPending
                        ? "Awaiting decision"
                        : isFuture
                          ? "Pending"
                          : `10:24:${31 + index}`}
                    </small>
                  </div>
                  {!isPending && !isFuture ? <Check className="w-3.5 text-sentinel-lime" aria-hidden="true" /> : null}
                </li>
              );
            })}
          </ol>
        </section>

        <section className="pb-[19px]">
          <header className={panelHeader}>Selected request <RiskBadge level={scenario.risk} /></header>
          <div className="flex items-center gap-4 px-[25px] pb-2 pt-6">
            <span className="grid h-[60px] w-[60px] place-items-center rounded-[5px] border border-sentinel-lime bg-sentinel-lime/10 text-sentinel-lime [&_svg]:w-7"><Icon aria-hidden="true" /></span>
            <div>
              <h3 className="m-0 text-[22px] font-medium tracking-[-0.04em]">{scenario.agent}</h3>
              <p className="mt-1.5 text-[13px] text-sentinel-muted">{scenario.action}</p>
            </div>
          </div>
          <strong className="block border-b border-sentinel-line px-[25px] pb-[18px] pt-1.5 font-mono text-[clamp(26px,2.4vw,38px)] font-normal tracking-[-0.04em]">{scenario.amount}</strong>
          <dl className="m-0 px-[25px] py-[7px] [&_dt]:font-mono [&_dt]:text-[9px] [&_dt]:uppercase [&_dt]:tracking-[0.1em] [&_dt]:text-sentinel-muted [&_dd]:m-0 [&_dd]:flex [&_dd]:items-center [&_dd]:justify-end [&_dd]:gap-2 [&_dd]:text-xs [&_svg]:w-3.5 [&>div:last-child_dd]:text-sentinel-red">
            <div className={factRow}><dt>Owner</dt><dd>{scenario.owner}</dd></div>
            <div className={factRow}><dt>Environment</dt><dd>{scenario.environment}<i className="h-1.5 w-1.5 rounded-full bg-sentinel-lime" /></dd></div>
            <div className={factRow}><dt>Policy</dt><dd>{scenario.policy}<ChevronRight /></dd></div>
            <div className={factRow}><dt>Risk classification</dt><dd>{scenario.risk} risk</dd></div>
          </dl>
          <div className="mx-[25px] mt-2 rounded border border-sentinel-line bg-sentinel-canvas px-3.5 py-[13px]">
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-sentinel-muted">Request context</span>
            <dl className="mt-2.5 font-mono text-[9px] [&>div]:grid [&>div]:grid-cols-[115px_1fr] [&>div]:gap-2.5 [&>div]:py-[3px] [&_dt]:text-sentinel-muted [&_dd]:m-0 [&_dd]:overflow-hidden [&_dd]:text-ellipsis [&_dd]:whitespace-nowrap">
              <div><dt>Request ID</dt><dd>REQ-7f2b1c9e</dd></div>
              <div><dt>Requested by</dt><dd>{scenario.agent.toLowerCase().replaceAll(" ", "-")}@sentinelops.ai</dd></div>
              <div><dt>Business purpose</dt><dd>Q2 services · infrastructure</dd></div>
            </dl>
          </div>
        </section>

        <section className="max-lg:col-span-full max-lg:grid max-lg:grid-cols-2 max-lg:border-t max-lg:border-sentinel-line max-lg:pb-[22px] max-[760px]:col-auto max-[760px]:block">
          <header className={`${panelHeader} max-lg:col-span-full`}>{scenario.automatic ? "Policy enforcement" : "Human approval"}</header>
          <div className="mx-[22px] mb-[18px] mt-6 flex items-center gap-3.5 border-b border-sentinel-line pb-5 max-lg:col-start-1">
            <span className="grid h-12 w-12 place-items-center rounded-full border border-emerald-500/50 dark:border-sentinel-lime font-mono text-sm text-emerald-600 dark:text-sentinel-lime bg-emerald-500/10 dark:bg-sentinel-lime/10 [&_svg]:w-[22px]">{scenario.automatic ? <ShieldAlert /> : "FL"}</span>
            <div className="grid gap-1">
              <strong className="text-[15px] text-sentinel-text">{scenario.automatic ? "SentinelOps" : "Finance Lead"}</strong>
              <small className="text-[10px] text-sentinel-muted">{scenario.automatic ? "Deterministic policy" : "Required approver"}</small>
            </div>
          </div>
          {scenario.automatic ? (
            <div className="mx-[22px] flex items-center gap-3 rounded border border-sentinel-red/50 bg-sentinel-red/10 p-[13px] text-sentinel-red max-lg:col-start-1">
              <X aria-hidden="true" />
              <div className="grid gap-1"><strong className="text-xs">Execution blocked</strong><span className="text-[9px] text-sentinel-muted">Production deployment window is closed.</span></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 px-[22px] max-lg:col-start-1">
              <button className="flex min-h-12 items-center justify-center gap-2.5 rounded-full border border-emerald-500 dark:border-sentinel-lime bg-emerald-500 dark:bg-sentinel-lime text-xs font-bold text-white dark:text-[#081004] shadow-sm transition hover:-translate-y-px [&_svg]:w-4" type="button" onClick={() => setDecision("approved")}><Check /> Approve</button>
              <button className="flex min-h-12 items-center justify-center gap-2.5 rounded-full border border-sentinel-line bg-sentinel-surface text-xs font-bold text-sentinel-text transition hover:-translate-y-px hover:border-sentinel-red hover:bg-sentinel-red/10 [&_svg]:w-4" type="button" onClick={() => setDecision("denied")}><X /> Deny</button>
            </div>
          )}
          <p className="mx-[22px] mb-[18px] mt-[11px] text-[10px] leading-normal text-sentinel-muted max-lg:col-start-1">
            The decision is enforced before the requested action can run.
          </p>
          <div
            className={`mx-[22px] rounded-[5px] border bg-sentinel-surface p-[15px] max-lg:col-start-2 max-lg:row-[2/6] max-lg:mt-6 max-[760px]:mt-[18px] ${
              finalDecision !== "pending" ? "border-sentinel-lime/40" : "border-sentinel-line"
            }`}
            aria-live="polite"
          >
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-sentinel-muted">Audit evidence</span>
            {finalDecision === "pending" ? (
              <div className="grid min-h-32 place-items-center content-center gap-[7px] text-center text-sentinel-muted">
                <ShieldAlert className="w-[25px] text-sentinel-amber" />
                <strong className="text-xs text-sentinel-text">Awaiting decision</strong>
                <small className="text-[9px]">Evidence will be sealed after enforcement.</small>
              </div>
            ) : (
              <>
                <div className="my-[13px] mb-[9px] flex items-center gap-2.5 text-sentinel-lime [&_svg]:w-[25px]">
                  {finalDecision === "approved" ? <CheckCircle2 /> : <X />}
                  <strong className="font-mono text-[17px] tracking-[0.08em]">{finalDecision === "approved" ? "APPROVED" : "BLOCKED"}</strong>
                </div>
                <dl className="m-0 [&_dt]:text-sentinel-muted [&_dd]:m-0 [&_dd]:text-right [&_dd]:capitalize">
                  <div className={evidenceRow}><dt>Decision by</dt><dd>{scenario.automatic ? "Policy engine" : "Finance Lead"}</dd></div>
                  <div className={evidenceRow}><dt>Policy</dt><dd>{scenario.policy}</dd></div>
                  <div className={evidenceRow}><dt>Result</dt><dd>{finalDecision}</dd></div>
                </dl>
                <button className="mt-[11px] flex items-center gap-2 border-0 bg-transparent p-0 text-[9px] text-sentinel-lime [&_svg]:w-[13px]" type="button" onClick={downloadEvidence}>
                  <Download /> Download audit record
                </button>
              </>
            )}
          </div>
          {finalDecision !== "pending" && !scenario.automatic ? (
            <button type="button" className="mx-[22px] mt-3 flex items-center gap-2 border-0 bg-transparent p-0 text-[9px] text-sentinel-muted max-lg:col-start-1 [&_svg]:w-[13px]" onClick={() => setDecision("pending")}>
              <RotateCcw /> Reset demo
            </button>
          ) : null}
        </section>
      </div>

      <div className="mt-3.5 grid gap-2.5" aria-label="Demo scenarios">
        {(Object.keys(scenarios) as ScenarioId[]).map((id) => {
          const item = scenarios[id];
          const ItemIcon = item.icon;
          const isSelected = activeId === id;
          return (
            <button
              type="button"
              key={id}
              className={`grid min-h-[70px] grid-cols-[42px_1.25fr_auto_0.7fr_18px] items-center gap-[18px] rounded-2xl border px-5 text-left transition-all hover:translate-x-1 shadow-sm max-[760px]:min-h-[94px] max-[760px]:grid-cols-[34px_1fr_18px] max-[760px]:gap-[11px] max-[760px]:p-3 max-[760px]:[&>span:nth-of-type(2)]:hidden ${
                isSelected
                  ? "border-emerald-600 dark:border-sentinel-lime bg-emerald-500/10 dark:bg-sentinel-lime/10 shadow-md"
                  : "border-sentinel-line bg-sentinel-surface hover:border-emerald-500/50 dark:hover:border-sentinel-lime/50 hover:bg-sentinel-surface-raised"
              }`}
              onClick={() => selectScenario(id)}
            >
              <ItemIcon className="w-6 text-emerald-600 dark:text-sentinel-lime" aria-hidden="true" />
              <span className="grid gap-1">
                <strong className="text-xs font-bold text-sentinel-text">{item.agent}</strong>
                <small className="text-[10px] text-sentinel-muted">{item.action}</small>
              </span>
              <RiskBadge level={item.risk} />
              <b className="text-right text-[10px] font-bold text-emerald-700 dark:text-sentinel-lime max-[760px]:hidden">{item.outcome}</b>
              <ArrowRight className="w-3.5 text-sentinel-muted" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
