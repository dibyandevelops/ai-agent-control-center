import Link from "next/link";
import { ArrowRight, Check, Sparkles } from "lucide-react";

const plans = ["Starter", "Pro", "Advanced"];

export function PricingSection() {
  return (
    <section
      className="relative mx-auto max-w-[1380px] px-6 py-20 lg:py-28"
      id="pricing"
    >
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sentinel-line bg-sentinel-surface px-3.5 py-1 text-xs font-semibold text-sentinel-muted">
          <Sparkles className="h-3.5 w-3.5 text-sentinel-lime" />
          Free pilot
        </div>
        <h2 className="text-3xl font-black tracking-tight text-sentinel-text sm:text-4xl lg:text-5xl">
          Start governing agents for free.
        </h2>
        <p className="mt-4 text-base leading-relaxed text-sentinel-muted sm:text-lg">
          Start with the free Pilot workspace. Starter, Pro, and Advanced are planned for the future and are not available to purchase yet.
        </p>
      </div>

      <ul className="mx-auto mt-9 flex max-w-2xl flex-wrap justify-center gap-3">
        {plans.map((plan) => (
          <li
            className="inline-flex items-center gap-2 rounded-full border border-sentinel-line bg-sentinel-surface px-4 py-2 text-sm font-semibold text-sentinel-text"
            key={plan}
          >
            <Check className="h-4 w-4 text-sentinel-lime" />
            {plan}
          </li>
        ))}
      </ul>

      <div className="mt-9 flex justify-center">
        <Link
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sentinel-lime px-6 py-3 text-sm font-bold text-sentinel-canvas transition hover:brightness-110"
          href="/pricing"
        >
          See the free pilot
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
