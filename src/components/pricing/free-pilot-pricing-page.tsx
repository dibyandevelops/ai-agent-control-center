import Link from "next/link";
import { ArrowRight, Check, Mail, Sparkles } from "lucide-react";
import { planCatalog } from "@/lib/plan-catalog";

const futurePlans = [
  {
    name: "Starter",
    description: "More room for a small team to govern its agent workflows.",
  },
  {
    name: "Pro",
    description: "Expanded oversight and controls for growing deployments.",
  },
  {
    name: "Advanced",
    description: "Broader governance for complex, organization-wide use.",
  },
];

export function FreePilotPricingPage() {
  const pilot = planCatalog.pilot;
  const pilotLimits = [
    `Up to ${pilot.agents} AI agents`,
    `${pilot.repositories} connected repositories`,
    `${pilot.pendingApprovals} pending approvals`,
    `${pilot.auditRetentionDays}-day audit history`,
    `${pilot.httpsWebhooks} HTTPS webhook destinations`,
  ];

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-sentinel-line bg-sentinel-surface px-3 py-1 text-xs font-semibold text-sentinel-muted">
          <Sparkles className="h-3.5 w-3.5 text-sentinel-lime" />
          Free pilot
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-sentinel-text sm:text-6xl">
          Start with <span className="text-sentinel-lime">stronger guardrails.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-sentinel-muted sm:text-lg">
          Try SentinelOps with a free pilot workspace. No paid plans or checkout are currently offered.
        </p>
      </header>

      <div className="mx-auto mt-12 grid max-w-5xl gap-5 lg:grid-cols-[1fr_1.35fr]">
        <article className="flex flex-col rounded-3xl border border-sentinel-lime bg-sentinel-surface p-7 shadow-xl shadow-sentinel-lime/10 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wide text-sentinel-lime">Available now</p>
          <h2 className="mt-3 text-2xl font-black text-sentinel-text">Pilot</h2>
          <p className="mt-2 text-sm leading-6 text-sentinel-muted">
            Core controls to evaluate SentinelOps with a small agent setup.
          </p>
          <p className="mt-6 text-4xl font-black tracking-tight text-sentinel-text">Free</p>
          <ul className="mt-6 space-y-3 border-t border-sentinel-line pt-6">
            {pilotLimits.map((limit) => (
              <li key={limit} className="flex gap-3 text-sm leading-5 text-sentinel-text">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-lime" />
                <span>{limit}</span>
              </li>
            ))}
          </ul>
          <Link
            className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sentinel-lime px-5 py-3 text-sm font-bold text-sentinel-canvas transition hover:brightness-110"
            href="/get-started"
          >
            Start free <ArrowRight className="h-4 w-4" />
          </Link>
        </article>

        <article className="rounded-3xl border border-sentinel-line bg-sentinel-surface/70 p-7 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-wide text-sentinel-muted">Planned · not available to purchase</p>
          <h2 className="mt-3 text-2xl font-black text-sentinel-text">More ways to scale</h2>
          <p className="mt-2 text-sm leading-6 text-sentinel-muted">
            We&apos;re exploring additional plan levels. Features and availability may change before launch.
          </p>
          <div className="mt-6 divide-y divide-sentinel-line border-y border-sentinel-line">
            {futurePlans.map((plan) => (
              <div key={plan.name} className="flex items-start justify-between gap-4 py-4">
                <div>
                  <h3 className="font-bold text-sentinel-text">{plan.name}</h3>
                  <p className="mt-1 text-sm leading-5 text-sentinel-muted">{plan.description}</p>
                </div>
                <span className="shrink-0 rounded-full border border-sentinel-line px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-sentinel-muted">
                  Coming soon
                </span>
              </div>
            ))}
          </div>
          <a
            className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-sentinel-lime hover:underline"
            href="mailto:cs@sentinelops-ai.com?subject=SentinelOps%20plan%20updates"
          >
            <Mail className="h-4 w-4" /> Ask us about future plans
          </a>
        </article>
      </div>
      <p className="mx-auto mt-8 max-w-3xl text-center text-xs leading-5 text-sentinel-muted">
        No payment details are requested to start the free pilot. Paid subscriptions are not currently available.
      </p>
    </section>
  );
}
