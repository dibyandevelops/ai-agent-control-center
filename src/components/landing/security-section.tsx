import {
  ArrowDown,
  Bot,
  Check,
  ClipboardCheck,
  Fingerprint,
  Lock,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Timer,
  X,
} from "lucide-react";
import { Reveal } from "./reveal";
import { SectionHeader } from "./ui";

const principles = [
  {
    index: "01",
    title: "Least-privilege permissions",
    body: "Give every agent strictly the data, tools, and action scopes it needs.",
    icon: ShieldCheck,
  },
  {
    index: "02",
    title: "5s Undo grace period for approvals",
    body: "Reversible human-in-the-loop decisions with optimistic undo buffer.",
    icon: Timer,
  },
  {
    index: "03",
    title: "Cryptographic evidence by default",
    body: "Preserve immutable SHA-256 signed audit chains with 0 tamper anomalies.",
    icon: ClipboardCheck,
  },
  {
    index: "04",
    title: "Instant fleet quarantine kill-switch",
    body: "Revoke all tool access from rogue or compromised agents in <100ms.",
    icon: ShieldAlert,
  },
] as const;

const layers = [
  { label: "Identity", detail: "Users, agents, SAML 2.0 / SCIM, Turnstile bot shield", icon: Fingerprint },
  { label: "Policy", detail: "Deterministic rules, context, risk scores, velocity limits", icon: ShieldCheck },
  { label: "Approvals", detail: "Slack interactive blocks, web dashboard, 5s undo window", icon: Timer },
  { label: "Audit & Proofs", detail: "SOC 2 Type II & ISO 27001 signed cryptographic certificates", icon: ClipboardCheck },
] as const;

const recentInnovations = [
  {
    title: "Interactive 5-Second Undo",
    desc: "Optimistic approval grace period allows operators to reverse accidental approvals or rejections in Slack and web console before downstream tools execute.",
    icon: RotateCcw,
    badge: "Operational Safety",
  },
  {
    title: "One-Click Compliance Attestation",
    desc: "Generate cryptographically verifiable SOC 2 Type II and ISO/IEC 27001 evidence packages with SHA-256 root hashes and zero tamper anomalies.",
    icon: ShieldCheck,
    badge: "Audit & Legal Ready",
  },
  {
    title: "Emergency Fleet Quarantine Engine",
    desc: "One-click containment kill-switch instantly strips permissions from misbehaving agents across your production estate without redeploying code.",
    icon: ShieldAlert,
    badge: "Threat Containment",
  },
  {
    title: "Cloudflare Turnstile Bot Defense",
    desc: "Seamless, invisible bot mitigation guarding public workspace creation and sign-in endpoints, combined with SAML 2.0 / SCIM directory sync.",
    icon: Lock,
    badge: "Zero-Trust Fortress",
  },
] as const;

const controls = [
  "SOC 2 Type II Attestation",
  "ISO/IEC 27001 Mapping",
  "5s Undo Grace Window",
  "SHA-256 Merkle Seals",
  "Turnstile Bot Shield",
  "Fleet Quarantine Kill-Switch",
  "SAML 2.0 & SCIM 2.0",
  "RBAC & Dual-Key Signoff",
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
                <article className="grid min-h-24 grid-cols-[50px_34px_1fr] items-center gap-3.5 border-t border-sentinel-line max-[760px]:min-h-[120px] max-[760px]:grid-cols-[38px_25px_1fr]" key={title}>
                  <Icon className="w-[28px] text-sentinel-text [stroke-width:1.3]" aria-hidden="true" />
                  <span className="font-mono text-[9px] text-emerald-600 dark:text-sentinel-lime">{index}</span>
                  <div><h3 className="m-0 font-mono text-sm font-medium max-[760px]:text-xs max-[760px]:leading-normal">{title}</h3><p className="mt-1 text-[11px] text-sentinel-muted">{body}</p></div>
                </article>
              ))}
            </div>
          </div>
          <div className="grid content-center p-[45px] max-[760px]:p-[28px_18px]">
            <span className="mb-[18px] font-mono text-[11px] uppercase tracking-[0.1em] text-emerald-700 dark:text-sentinel-lime font-bold">Enforcement & Safety Boundary</span>
            <div className="mx-auto flex min-h-[54px] w-[58%] items-center justify-center gap-2.5 rounded-xl border border-sentinel-line bg-sentinel-surface text-xs text-sentinel-text shadow-sm max-[760px]:w-full [&_svg]:w-[18px]"><Bot /> Agent request</div>
            <ArrowDown className="mx-auto my-[7px] w-4 text-sentinel-muted" />
            <div className="flex min-h-[54px] items-center justify-center gap-2.5 rounded-xl border border-emerald-500/50 dark:border-sentinel-lime bg-emerald-500/10 dark:bg-sentinel-lime/10 text-xs font-semibold text-emerald-700 dark:text-sentinel-lime shadow-sm [&_svg]:w-[18px]"><ShieldCheck /> SentinelOps policy gateway (sub-20ms)</div>
            <div className="mt-[17px] grid grid-cols-3 gap-2.5 max-[760px]:grid-cols-1 [&>span]:flex [&>span]:min-h-12 [&>span]:items-center [&>span]:justify-center [&>span]:gap-2 [&>span]:rounded-xl [&>span]:border [&>span]:text-[10px] [&>span]:font-bold [&_svg]:w-4">
              <span className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-sentinel-lime"><Check /> Allow</span>
              <span className="border-sentinel-amber/40 bg-sentinel-amber/10 text-amber-700 dark:text-sentinel-amber"><Timer /> 5s Grace approval</span>
              <span className="border-sentinel-red/40 bg-sentinel-red/10 text-red-700 dark:text-sentinel-red"><X /> Quarantine / Block</span>
            </div>
            <div className="mt-7 grid">
              {layers.map(({ label, detail, icon: Icon }) => (
                <div className="grid min-h-12 grid-cols-[26px_110px_1fr] items-center border-t border-sentinel-line max-[760px]:grid-cols-[25px_88px_1fr]" key={label}>
                  <Icon className="w-4 text-emerald-600 dark:text-sentinel-lime" aria-hidden="true" />
                  <strong className="text-[10px] text-sentinel-text">{label}</strong>
                  <span className="text-[9px] text-sentinel-muted">{detail}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4-Pillar Architectural Innovations Grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {recentInnovations.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-5 flex flex-col justify-between transition hover:border-emerald-500/40 dark:hover:border-sentinel-lime/40 shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="p-2 rounded-lg bg-emerald-500/10 dark:bg-sentinel-lime/10 text-emerald-600 dark:text-sentinel-lime border border-emerald-500/20 dark:border-sentinel-lime/20">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-emerald-700 dark:text-sentinel-lime font-bold">
                      {item.badge}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-sentinel-text mb-1.5">{item.title}</h4>
                  <p className="text-xs text-sentinel-muted leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise Compliance Marquee */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sentinel-line-strong bg-sentinel-surface/90 px-6 py-4 shadow-sm">
          <strong className="font-mono text-xs uppercase tracking-wider text-sentinel-text shrink-0 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-sentinel-lime" /> Enterprise-grade assurance
          </strong>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {controls.map((control) => (
              <span key={control} className="font-mono text-[10px] text-sentinel-muted flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-sentinel-lime inline-block" />
                {control}
              </span>
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
