"use client";

import {
  BookOpen,
  Bot,
  Check,
  Code2,
  Copy,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Agent } from "@/lib/types";
import { BrandMark } from "../navigation/sidebar";

export function RegisterDialog({
  open,
  onClose,
  onRegister,
}: {
  open: boolean;
  onClose: () => void;
  onRegister: (agent: Agent) => void | Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<"register" | "guide">("register");
  const [selectedLang, setSelectedLang] = useState<"python" | "node" | "curl">("python");
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [team, setTeam] = useState("Platform Engineering");
  const [provider, setProvider] = useState("OpenAI");

  if (!open) return null;

  const agentId = name.trim()
    ? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")
    : "my-agent";

  const snippets = {
    python: `# Install: pip install sentinelops-ai
from sentinelops import SentinelOps

sentinel = SentinelOps(api_key="sop_live_...")

# Guard consequential actions before execution:
decision = sentinel.evaluate(
    agent_id="${agentId}",
    agent_name="${name.trim() || "My AI Agent"}",
    action="resource.mutate",
    resource="target/resource-id",
    context={"team": "${team}"}
)

if decision.approved:
    # Safe to execute mutation
    pass
elif decision.pending:
    # Awaiting human operator sign-off
    decision = sentinel.poll(decision.request_id, timeout=300)`,

    node: `// Node.js / TypeScript Direct HTTP
const res = await fetch("https://sentinelops.dev/api/v1/actions/evaluate", {
  method: "POST",
  headers: {
    Authorization: "Bearer sop_live_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    agent: {
      externalId: "${agentId}",
      name: "${name.trim() || "My AI Agent"}",
      team: "${team}",
      provider: "${provider}"
    },
    action: "resource.mutate",
    resource: "target/resource-id"
  })
});
const decision = await res.json();
console.log(decision.status); // "allowed" | "pending_approval"`,

    curl: `curl -X POST "https://sentinelops.dev/api/v1/actions/evaluate" \\
  -H "Authorization: Bearer sop_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent": {
      "externalId": "${agentId}",
      "name": "${name.trim() || "My AI Agent"}",
      "team": "${team}",
      "provider": "${provider}"
    },
    "action": "resource.mutate",
    "resource": "target/resource-id"
  }'`,
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(snippets[selectedLang]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !owner.trim()) return;
    void onRegister({
      id: `agent-${Date.now()}`,
      name: name.trim(),
      description: "Newly registered AI agent awaiting expanded configuration.",
      owner: owner.trim(),
      team,
      status: "healthy",
      provider,
      permissions: ["No permissions granted"],
      actions: 0,
      cost: 0,
      lastAction: "Agent registered",
      lastSeen: "Just now",
    });
    setName("");
    setOwner("");
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="dialog max-w-xl w-full"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="dialog-header">
          <div className="dialog-title">
            <BrandMark small />
            <div>
              <h2 id="register-title">Register AI agent</h2>
              <p>Add ownership details and connect your agent SDK or runtime.</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-sentinel-line px-5 pt-2 pb-2 bg-sentinel-canvas/40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("register")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "register"
                  ? "bg-sentinel-surface text-sentinel-lime border border-sentinel-line shadow-xs"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>Identity & Team</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("guide")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === "guide"
                  ? "bg-sentinel-surface text-sentinel-lime border border-sentinel-line shadow-xs"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Connection Guide</span>
            </button>
          </div>

          <Link
            href="/docs/connecting-agents"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold text-sentinel-lime hover:underline shrink-0"
            title="Open comprehensive agent connection guide in a new tab"
          >
            <BookOpen className="h-3 w-3" />
            <span className="hidden sm:inline">Full Documentation</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>

        {activeTab === "register" ? (
          <form onSubmit={submit}>
            <label>
              Agent name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sales Representative Agent"
                autoFocus
                required
              />
            </label>
            <div className="form-grid">
              <label>
                Owner email
                <input
                  type="email"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="owner@company.com"
                  required
                />
              </label>
              <label>
                Team
                <select value={team} onChange={(e) => setTeam(e.target.value)}>
                  <option>Platform Engineering</option>
                  <option>Finance</option>
                  <option>Security</option>
                  <option>Legal</option>
                  <option>Customer Support</option>
                  <option>Sales & Revenue</option>
                </select>
              </label>
            </div>
            <label>
              Model provider
              <select value={provider} onChange={(e) => setProvider(e.target.value)}>
                <option>OpenAI</option>
                <option>Anthropic</option>
                <option>Google</option>
                <option>Azure AI</option>
                <option>Self-hosted</option>
              </select>
            </label>
            <div className="security-note">
              <LockKeyhole />
              <div>
                <strong>Zero-Trust enforced</strong>
                <span>New agents start with zero permissions until evaluated policies are assigned.</span>
              </div>
            </div>
            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
              <button className="primary-button" type="submit">
                <Bot /> Register agent
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 space-y-4">
            {/* Guide Quick Snippet Box */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-sentinel-line pb-3">
              <div className="flex items-center gap-1.5 rounded-lg border border-sentinel-line bg-sentinel-canvas/70 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedLang("python")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    selectedLang === "python"
                      ? "bg-sentinel-surface text-sentinel-lime shadow-xs"
                      : "text-sentinel-muted hover:text-sentinel-text"
                  }`}
                >
                  Python SDK
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLang("node")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    selectedLang === "node"
                      ? "bg-sentinel-surface text-sentinel-lime shadow-xs"
                      : "text-sentinel-muted hover:text-sentinel-text"
                  }`}
                >
                  Node / TS
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLang("curl")}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                    selectedLang === "curl"
                      ? "bg-sentinel-surface text-sentinel-lime shadow-xs"
                      : "text-sentinel-muted hover:text-sentinel-text"
                  }`}
                >
                  cURL / API
                </button>
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg border border-sentinel-line/80 bg-sentinel-surface px-2.5 py-1 text-xs font-semibold text-sentinel-muted hover:text-sentinel-text cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-sentinel-lime" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? "Copied" : "Copy Code"}</span>
              </button>
            </div>

            <pre className="max-h-64 overflow-x-auto rounded-xl border border-sentinel-line/80 bg-sentinel-canvas p-3.5 font-mono text-[11px] text-sentinel-text/90 leading-relaxed scroll-touch">
              {snippets[selectedLang]}
            </pre>

            <div className="rounded-xl border border-sentinel-lime/30 bg-sentinel-lime/5 p-3.5 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-sentinel-text">
                <Sparkles className="h-4 w-4 text-sentinel-lime" />
                <span>Complete Agent Integration Docs Available</span>
              </div>
              <p className="text-[11px] text-sentinel-muted leading-relaxed">
                Learn how to configure LangChain adapters, CrewAI tools, multi-party quorum human-in-the-loop approvals, and outcome reporting.
              </p>
              <div className="pt-1">
                <Link
                  href="/docs/connecting-agents"
                  target="_blank"
                  className="inline-flex items-center gap-1.5 font-semibold text-sentinel-lime hover:underline text-xs"
                >
                  <span>Open comprehensive connection documentation</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="dialog-actions pt-2">
              <button
                type="button"
                className="secondary-button w-full sm:w-auto"
                onClick={() => setActiveTab("register")}
              >
                Back to Registration Form
              </button>
              <button
                type="button"
                className="primary-button w-full sm:w-auto"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
