"use client";

import {
  AlertTriangle,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Info,
  KeyRound,
  Play,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import {
  getQuickstartSnippet,
  quickstartLanguages,
  type QuickstartLanguage,
} from "@/lib/agent-quickstart";

export function AgentQuickstart({ onCreateKey }: { onCreateKey: () => void }) {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [language, setLanguage] = useState<QuickstartLanguage>("curl");
  const [copied, setCopied] = useState(false);
  const snippet = getQuickstartSnippet(language);

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function selectLanguage(nextLanguage: QuickstartLanguage) {
    setLanguage(nextLanguage);
    setActiveStep(2);
    setCopied(false);
  }

  return (
    <section className="mb-5 overflow-hidden rounded-app border border-sentinel-line bg-sentinel-surface shadow-app-1">
      <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
        {/* Left Column: Interactive Steps */}
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

          <div className="mt-5 space-y-1.5" role="list">
            {/* Step 1 */}
            <button
              type="button"
              className={`w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                activeStep === 1
                  ? "border-sentinel-lime/40 bg-sentinel-lime/10 text-sentinel-text"
                  : "border-transparent bg-transparent hover:border-sentinel-line hover:bg-sentinel-canvas text-sentinel-muted hover:text-sentinel-text"
              }`}
              onClick={() => {
                setActiveStep(1);
                onCreateKey();
              }}
              title="Click to generate an agent API key"
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                  activeStep === 1
                    ? "border-sentinel-lime/30 bg-sentinel-lime/20 text-sentinel-lime"
                    : "border-sentinel-line bg-sentinel-raised text-sentinel-muted"
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-sentinel-dim">01</span>
                  <strong className="text-xs font-semibold text-sentinel-text">
                    Create a credential
                  </strong>
                </div>
                <p className="mt-0.5 text-[11px] text-sentinel-muted">
                  Generate an API key & store in your secret manager.
                </p>
              </div>
              <ChevronRight
                className={`h-4 w-4 shrink-0 transition ${
                  activeStep === 1 ? "text-sentinel-lime translate-x-0.5" : "text-sentinel-dim"
                }`}
              />
            </button>

            {/* Step 2 */}
            <button
              type="button"
              className={`w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                activeStep === 2
                  ? "border-sentinel-lime/40 bg-sentinel-lime/10 text-sentinel-text"
                  : "border-transparent bg-transparent hover:border-sentinel-line hover:bg-sentinel-canvas text-sentinel-muted hover:text-sentinel-text"
              }`}
              onClick={() => setActiveStep(2)}
              title="Click to view evaluation code snippet"
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                  activeStep === 2
                    ? "border-sentinel-lime/30 bg-sentinel-lime/20 text-sentinel-lime"
                    : "border-sentinel-line bg-sentinel-raised text-sentinel-muted"
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-sentinel-dim">02</span>
                  <strong className="text-xs font-semibold text-sentinel-text">
                    Add the evaluation call
                  </strong>
                </div>
                <p className="mt-0.5 text-[11px] text-sentinel-muted">
                  Use our cURL, Node, or Python SDK code block.
                </p>
              </div>
              <ChevronRight
                className={`h-4 w-4 shrink-0 transition ${
                  activeStep === 2 ? "text-sentinel-lime translate-x-0.5" : "text-sentinel-dim"
                }`}
              />
            </button>

            {/* Step 3 */}
            <button
              type="button"
              className={`w-full flex items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                activeStep === 3
                  ? "border-sentinel-lime/40 bg-sentinel-lime/10 text-sentinel-text"
                  : "border-transparent bg-transparent hover:border-sentinel-line hover:bg-sentinel-canvas text-sentinel-muted hover:text-sentinel-text"
              }`}
              onClick={() => setActiveStep(3)}
              title="Click to view decision handling guide"
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                  activeStep === 3
                    ? "border-sentinel-lime/30 bg-sentinel-lime/20 text-sentinel-lime"
                    : "border-sentinel-line bg-sentinel-raised text-sentinel-muted"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-sentinel-dim">03</span>
                  <strong className="text-xs font-semibold text-sentinel-text">
                    Honor the decision
                  </strong>
                </div>
                <p className="mt-0.5 text-[11px] text-sentinel-muted">
                  Execute only after allowed or approved.
                </p>
              </div>
              <ChevronRight
                className={`h-4 w-4 shrink-0 transition ${
                  activeStep === 3 ? "text-sentinel-lime translate-x-0.5" : "text-sentinel-dim"
                }`}
              />
            </button>
          </div>

          <button className="primary-button mt-5 w-full sm:w-auto" onClick={onCreateKey}>
            <KeyRound className="h-4 w-4" /> Create a key
          </button>
        </div>

        {/* Right Column: Code Snippet / Decision Guide */}
        <div className="min-w-0 bg-sentinel-canvas/35 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sentinel-line px-4 py-3">
              <div className="flex items-center gap-1 rounded-lg border border-sentinel-line bg-sentinel-canvas p-1">
                {quickstartLanguages.map((item) => (
                  <button
                    key={item.id}
                    className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${
                      language === item.id
                        ? "bg-sentinel-raised text-sentinel-text shadow-sm"
                        : "text-sentinel-muted hover:text-sentinel-text"
                    }`}
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
                title="Copy code snippet to clipboard"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-sentinel-lime" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy example"}
              </button>
            </div>

            <div className="border-b border-sentinel-line px-4 py-2.5 font-mono text-[10px] text-sentinel-muted flex items-center justify-between">
              <span>SENTINELOPS_BASE_URL=http://localhost:3000</span>
              <span className="text-sentinel-lime font-mono text-[10px]">POST /api/v1/actions/evaluate</span>
            </div>

            {activeStep === 3 ? (
              <div className="p-4 space-y-3">
                <div className="rounded-xl border border-sentinel-lime/30 bg-sentinel-lime/10 p-3 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-sentinel-lime">
                    <Check className="h-4 w-4" /> <code>status: &quot;allow&quot;</code>
                  </div>
                  <p className="mt-1 text-[11px] text-sentinel-text">
                    The action satisfies all active governance policies. The agent executes immediately.
                  </p>
                </div>

                <div className="rounded-xl border border-sentinel-amber/30 bg-sentinel-amber/10 p-3 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-sentinel-amber">
                    <AlertTriangle className="h-4 w-4" /> <code>status: &quot;require_approval&quot;</code>
                  </div>
                  <p className="mt-1 text-[11px] text-sentinel-text">
                    Action queued for human approval. Agent should await decision or poll <code>requestId</code>.
                  </p>
                </div>

                <div className="rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 p-3 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-red-300">
                    <ShieldAlert className="h-4 w-4 text-red-400" /> <code>status: &quot;block&quot;</code>
                  </div>
                  <p className="mt-1 text-[11px] text-sentinel-text">
                    Action rejected by security policy. Agent must halt execution and report to operator.
                  </p>
                </div>
              </div>
            ) : (
              <pre className="max-h-[330px] min-h-[270px] overflow-auto p-4 font-mono text-[11px] leading-5 text-sentinel-text">
                <code>{snippet}</code>
              </pre>
            )}
          </div>

          <div className="border-t border-sentinel-line px-4 py-2.5 text-[11px] text-sentinel-muted flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-sentinel-dim shrink-0" />
            <span>
              {activeStep === 1
                ? "Click 'Create a key' to open credential manager."
                : activeStep === 2
                ? "Paste this block before your agent's external tool call."
                : "Your code must branch on the evaluation response status."}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
