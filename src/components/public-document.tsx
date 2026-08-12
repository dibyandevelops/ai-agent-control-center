import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export function PublicDocument({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: Array<{ title: string; body: string }>;
}) {
  return <main className="min-h-screen bg-sentinel-canvas px-5 py-12 font-sentinel text-sentinel-text sm:px-8">
    <article className="mx-auto max-w-3xl">
      <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-sentinel-lime"><ShieldCheck className="h-5 w-5" /> SentinelOps</Link>
      <p className="mt-14 text-xs font-semibold uppercase tracking-[0.16em] text-sentinel-lime">Legal & security</p>
      <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
      <p className="mt-5 text-sm text-sentinel-muted">Last updated: {updated}</p>
      <p className="mt-10 text-lg leading-8 text-sentinel-muted">{intro}</p>
      <div className="mt-12 space-y-10">{sections.map((section) => <section key={section.title}><h2 className="text-xl font-bold">{section.title}</h2><p className="mt-3 whitespace-pre-line text-sm leading-7 text-sentinel-muted">{section.body}</p></section>)}</div>
      <p className="mt-16 border-t border-sentinel-line pt-6 text-sm text-sentinel-muted">Questions? Contact <a className="font-semibold text-sentinel-lime" href="mailto:security@sentinelops.ai">security@sentinelops.ai</a>.</p>
    </article>
  </main>;
}
