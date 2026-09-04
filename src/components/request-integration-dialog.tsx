"use client";

import {
  CheckCircle2,
  LoaderCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import React, { useState } from "react";

interface RequestIntegrationDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: (integrationName: string) => void;
  defaultEmail?: string;
}

const fieldClass =
  "mt-1.5 h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-xs text-sentinel-text outline-none transition placeholder:text-sentinel-dim focus:border-sentinel-lime/70 focus:ring-2 focus:ring-sentinel-lime/10";

export function RequestIntegrationDialog({
  open,
  onClose,
  onSubmitted,
  defaultEmail = "",
}: RequestIntegrationDialogProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Monitoring & Observability");
  const [useCase, setUseCase] = useState("");
  const [priority, setPriority] = useState<"evaluating" | "pilot" | "production">("pilot");
  const [email, setEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    // Simulate short network latency / payload submission
    await new Promise((resolve) => setTimeout(resolve, 600));

    setSubmitting(false);
    setSubmitted(true);

    setTimeout(() => {
      onSubmitted(name.trim());
      setSubmitted(false);
      setName("");
      setUseCase("");
      onClose();
    }, 1200);
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 max-sm:items-end max-sm:p-0 bg-black/75 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl max-sm:rounded-b-none max-sm:max-h-[90dvh] max-sm:overflow-y-auto border border-sentinel-line-strong bg-sentinel-surface shadow-2xl animate-dialog-in pb-safe"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-integration-title"
      >
        <div className="flex items-start justify-between border-b border-sentinel-line px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-sentinel-lime/30 bg-sentinel-lime/10 text-sentinel-lime">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="request-integration-title"
                className="text-base font-semibold tracking-tight text-sentinel-text"
              >
                Request an enterprise integration
              </h2>
              <p className="mt-0.5 text-xs text-sentinel-muted">
                Need support for a custom tool, SaaS API, or internal system?
              </p>
            </div>
          </div>
          <button
            className="grid h-8 w-8 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:border-sentinel-line-strong hover:text-sentinel-text"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-sentinel-lime/15 text-sentinel-lime">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <strong className="block text-sm font-semibold text-sentinel-text">
              Integration Request Received
            </strong>
            <p className="text-xs text-sentinel-muted max-w-sm mx-auto">
              Our solutions engineering team has recorded your request for <strong>{name}</strong>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
            <div>
              <label className="block text-xs font-medium text-sentinel-muted">
                Integration or Service Name
                <input
                  className={fieldClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Datadog, Jira Service Management, Snowflake, PagerDuty"
                  autoFocus
                  required
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-xs font-medium text-sentinel-muted">
                Category
                <select
                  className={fieldClass}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="Monitoring & Observability">Monitoring & Observability</option>
                  <option value="Ticketing & ITSM">Ticketing & ITSM</option>
                  <option value="Incident Response">Incident Response</option>
                  <option value="Data Warehouse & Lakehouse">Data Warehouse & Lakehouse</option>
                  <option value="Cloud Infrastructure">Cloud Infrastructure</option>
                  <option value="Custom REST / Webhook">Custom REST / Webhook</option>
                </select>
              </label>

              <label className="block text-xs font-medium text-sentinel-muted">
                Urgency
                <select
                  className={fieldClass}
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as "evaluating" | "pilot" | "production")
                  }
                >
                  <option value="evaluating">Evaluating future options</option>
                  <option value="pilot">Active pilot requirement</option>
                  <option value="production">Production blocker</option>
                </select>
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-sentinel-muted">
                Use Case & Desired Actions
                <textarea
                  className="mt-1.5 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 py-2 text-xs text-sentinel-text outline-none transition placeholder:text-sentinel-dim focus:border-sentinel-lime/70 focus:ring-2 focus:ring-sentinel-lime/10 resize-none h-20"
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  placeholder="What autonomous actions should SentinelOps monitor, gate, or approve for this integration?"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-sentinel-muted">
                Contact Email for Updates
                <input
                  className={fieldClass}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-sentinel-line pt-4 mt-5">
              <button
                type="button"
                className="secondary-button"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={submitting || !name.trim()}
              >
                {submitting ? (
                  <LoaderCircle className="animate-spin h-3.5 w-3.5" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
