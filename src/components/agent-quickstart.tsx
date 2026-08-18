"use client";

import {
  Check,
  ChevronRight,
  Code2,
  Copy,
  KeyRound,
  Play,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import {
  getQuickstartSnippet,
  quickstartLanguages,
  type QuickstartLanguage,
} from "@/lib/agent-quickstart";

export function AgentQuickstart({ onCreateKey }: { onCreateKey: () => void }) {
  const [language, setLanguage] = useState<QuickstartLanguage>("curl");
  const [copied, setCopied] = useState(false);
  const snippet = getQuickstartSnippet(language);

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
  }

  function selectLanguage(nextLanguage: QuickstartLanguage) {
    setLanguage(nextLanguage);
    setCopied(false);
  }

  return (
    <section className="mb-5 overflow-hidden rounded-app border border-sentinel-line bg-sentinel-surface shadow-app-1">
      <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
        <div className="border-b border-sentinel-line px-5 py-5 lg:border-b-0 lg:border-r">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sentinel-lime/20 bg-sentinel-lime/10 text-sentinel-lime">
              <Play className="h-4 w-4 fill-current" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-sentinel-text">Connect your first agent</h3>
              <p className="mt-1 max-w-md text-xs leading-5 text-sentinel-muted">
                Add the enforcement check before your agent performs a consequential action.
              </p>
            </div>
          </div>

          <ol className="mt-5 space-y-1">
            {[
              { icon: KeyRound, title: "Create a credential", detail: "Copy it to your secret manager." },
              { icon: Code2, title: "Add the evaluation call", detail: "Use our cURL, Node, or Python SDK code block." },
              { icon: ShieldCheck, title: "Honor the decision", detail: "Execute only after allowed or approved." },
            ].map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex items-center gap-3 rounded-xl px-2 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-sentinel-line bg-sentinel-raised text-sentinel-muted">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-sentinel-dim">0{index + 1}</span>
                      <strong className="text-xs font-semibold text-sentinel-text">{step.title}</strong>
                    </div>
                    <p className="mt-0.5 text-[11px] text-sentinel-muted">{step.detail}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-sentinel-dim" />
                </li>
              );
            })}
          </ol>

          <button className="primary-button mt-5" onClick={onCreateKey}>
            <KeyRound /> Create a key
          </button>
        </div>

        <div className="min-w-0 bg-sentinel-canvas/35">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sentinel-line px-4 py-3">
            <div className="flex items-center gap-1 rounded-lg border border-sentinel-line bg-sentinel-canvas p-1">
              {quickstartLanguages.map((item) => (
                <button
                  key={item.id}
                  className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${language === item.id ? "bg-sentinel-raised text-sentinel-text shadow-sm" : "text-sentinel-muted hover:text-sentinel-text"}`}
                  onClick={() => selectLanguage(item.id)}
                  aria-pressed={language === item.id}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-sentinel-line px-2.5 text-[11px] font-semibold text-sentinel-muted transition hover:border-sentinel-line-strong hover:text-sentinel-text"
              onClick={() => void copySnippet()}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-sentinel-lime" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy example"}
            </button>
          </div>
          <div className="border-b border-sentinel-line px-4 py-2.5 font-mono text-[10px] text-sentinel-muted">
            SENTINELOPS_BASE_URL=http://localhost:3000
          </div>
          <pre className="max-h-[330px] min-h-[270px] overflow-auto p-4 font-mono text-[11px] leading-5 text-sentinel-text"><code>{snippet}</code></pre>
        </div>
      </div>
    </section>
  );
}

