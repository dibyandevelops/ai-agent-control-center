import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";

const plans = [
  { name: "Pilot", description: "Validate one governed workflow with your team.", details: ["5 agents", "2 connected repositories", "20 pending approvals", "90-day audit retention"], action: "Start workspace", href: "/get-started" },
  { name: "Enterprise", description: "Scale governed agent operations with tailored controls.", details: ["Custom agents and repositories", "Configurable audit retention", "Enterprise identity and support", "Commercial terms by agreement"], action: "Talk to us", href: "mailto:sales@sentinelops.ai" },
];

export default function PricingPage() {
  return <main className="min-h-screen bg-sentinel-canvas px-5 py-12 font-sentinel text-sentinel-text sm:px-8"><div className="mx-auto max-w-5xl"><Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-sentinel-lime"><ShieldCheck className="h-5 w-5" /> SentinelOps</Link><h1 className="mt-16 max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">Start governed. Scale deliberately.</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-sentinel-muted">Billing is intentionally not enabled during the pilot. Limits are enforced so every workspace has a clear, safe path to expansion.</p><div className="mt-14 grid gap-5 md:grid-cols-2">{plans.map((plan) => <section className="rounded-3xl border border-sentinel-line bg-sentinel-surface p-7" key={plan.name}><h2 className="text-2xl font-bold">{plan.name}</h2><p className="mt-3 min-h-12 text-sm leading-6 text-sentinel-muted">{plan.description}</p><ul className="mt-8 space-y-3 text-sm text-sentinel-muted">{plan.details.map((detail) => <li className="flex gap-2" key={detail}><Check className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-lime" />{detail}</li>)}</ul><Link href={plan.href} className="primary-button mt-10 w-full justify-center">{plan.action}<ArrowRight /></Link></section>)}</div><p className="mt-8 text-center text-xs text-sentinel-dim">No card required. No automatic charge is created from this page.</p></div></main>;
}
