import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";

function renderLinkedText(text: string) {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, index) => {
    if (!part.startsWith("https://") && !part.startsWith("http://")) return part;
    return (
      <a
        key={`${part}-${index}`}
        className="text-sentinel-lime underline underline-offset-2"
        href={part}
        rel="noreferrer"
        target="_blank"
      >
        {part}
      </a>
    );
  });
}

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
  return (
    <div className="min-h-screen overflow-clip bg-sentinel-canvas font-sentinel text-sentinel-text">
      <LandingHeader />
      <main className="px-6 pt-32 pb-24 sm:px-8">
        <article className="mx-auto max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-sentinel-lime">
            Legal & Security
          </span>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight text-sentinel-text">
            {title}
          </h1>
          <p className="mt-3 text-xs text-sentinel-muted">Last updated: {updated}</p>
          <p className="mt-8 text-base sm:text-lg leading-relaxed text-sentinel-muted">
            {intro}
          </p>
          <div className="mt-12 space-y-10">
            {sections.map((section) => (
              <section key={section.title} className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-6 sm:p-8">
                <h2 className="text-lg sm:text-xl font-bold text-sentinel-text">
                  {section.title}
                </h2>
                <p className="mt-3 whitespace-pre-line text-xs sm:text-sm leading-relaxed text-sentinel-muted">
                  {renderLinkedText(section.body)}
                </p>
              </section>
            ))}
          </div>
          <p className="mt-12 border-t border-sentinel-line pt-6 text-xs text-sentinel-muted">
            Questions? Contact{" "}
            <a
              className="font-semibold text-sentinel-lime hover:underline"
              href="mailto:cs@sentinelops-ai.com"
            >
              cs@sentinelops-ai.com
            </a>
            .
          </p>
        </article>
      </main>
      <LandingFooter />
    </div>
  );
}
