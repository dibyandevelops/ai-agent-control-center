"use client";

import { AlertTriangle, ExternalLink, LoaderCircle, LockKeyhole, ShieldAlert, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { GitHubDriftIncident } from "@/lib/types";

function detectedTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function GitHubDriftIncidents({
  incidents,
  canAcknowledge,
  onAcknowledge,
  onResolve,
  onViewEvidence,
}: {
  incidents: GitHubDriftIncident[];
  canAcknowledge: boolean;
  onAcknowledge: (incidentId: string, note: string) => Promise<void>;
  onResolve: (incidentId: string, note: string) => Promise<void>;
  onViewEvidence: (requestId: string) => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState("");

  if (!incidents.length) return null;

  async function acknowledge(incident: GitHubDriftIncident) {
    const note = notes[incident.id]?.trim();
    if (!note || loadingId) return;
    setLoadingId(incident.id);
    try {
      await onAcknowledge(incident.id, note);
      setNotes((current) => ({ ...current, [incident.id]: "" }));
    } finally {
      setLoadingId("");
    }
  }

  async function resolve(incident: GitHubDriftIncident) {
    const note = notes[incident.id]?.trim();
    if (!note || loadingId) return;
    setLoadingId(incident.id);
    try {
      await onResolve(incident.id, note);
      setNotes((current) => ({ ...current, [incident.id]: "" }));
    } finally {
      setLoadingId("");
    }
  }

  return (
    <section className="mt-7 rounded-2xl border border-red-400/25 bg-red-400/[0.035] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-xl border border-red-400/30 bg-red-400/10 p-2.5 text-red-600 dark:text-red-300">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-sentinel-text">GitHub governance incidents</h3>
            <p className="mt-1 text-sm leading-6 text-sentinel-muted">
              Signed GitHub events that do not match SentinelOps approval evidence.
            </p>
          </div>
        </div>
        <span className="rounded-full border border-red-400/30 bg-red-400/10 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-300">
          {incidents.length} active
        </span>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        {incidents.map((incident) => {
          const note = notes[incident.id] ?? "";
          return (
            <article key={incident.id} className="min-w-0 rounded-xl border border-sentinel-line bg-sentinel-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-red-600 dark:text-red-300">
                    {incident.eventAction} release
                  </span>
                  <h4 className="mt-2 break-all text-sm font-semibold text-sentinel-text">
                    {incident.repository}@{incident.tagName}
                  </h4>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ${incident.severity === "critical" ? "border-red-400/40 bg-red-400/10 text-red-600 dark:text-red-300" : "border-sentinel-amber/40 bg-sentinel-amber/10 text-sentinel-amber"}`}>
                  {incident.severity} · {incident.status}
                </span>
              </div>
              {incident.severity === "critical" ? (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-3 text-xs font-semibold leading-5 text-red-800 dark:text-red-100">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-300" />
                  Publish and cancel automation for this repository and tag is frozen until resolution.
                </div>
              ) : null}

              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-3 text-xs leading-5 text-red-800 dark:text-red-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-300" />
                <span className="min-w-0 break-words">{incident.reason}</span>
              </div>
              <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-sentinel-dim">GitHub actor</dt>
                  <dd className="mt-1 break-all text-sentinel-text">@{incident.actorLogin}</dd>
                </div>
                <div>
                  <dt className="text-sentinel-dim">Detected</dt>
                  <dd className="mt-1 text-sentinel-text">{detectedTime(incident.detectedAt)}</dd>
                </div>
              </dl>

              {incident.status === "acknowledged" ? (
                <div className="mt-4 rounded-lg border border-sentinel-line bg-sentinel-canvas/60 px-3 py-3 text-xs leading-5 text-sentinel-muted">
                  <span className="font-semibold text-sentinel-text">Acknowledged by {incident.acknowledgedBy ?? "an administrator"}</span>
                  {incident.acknowledgmentNote ? <p className="mt-1 break-words">{incident.acknowledgmentNote}</p> : null}
                </div>
              ) : null}

              {canAcknowledge ? (
                <div className="mt-4 space-y-2">
                  <input
                    className="h-10 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-xs text-sentinel-text outline-none placeholder:text-sentinel-dim focus:border-red-300/60"
                    value={note}
                    onChange={(event) => setNotes((current) => ({ ...current, [incident.id]: event.target.value }))}
                    placeholder={incident.status === "open" ? "Investigation or containment note (required)" : "Resolution and remediation note (required)"}
                    aria-label={`${incident.status === "open" ? "Acknowledgment" : "Resolution"} note for ${incident.repository} ${incident.tagName}`}
                  />
                  <button
                    type="button"
                    className="secondary-button w-full justify-center"
                    disabled={!note.trim() || Boolean(loadingId)}
                    onClick={() => void (incident.status === "open" ? acknowledge(incident) : resolve(incident))}
                  >
                    {loadingId === incident.id ? <LoaderCircle className="animate-spin" /> : incident.status === "open" ? <ShieldAlert /> : <ShieldCheck />}
                    {incident.status === "open"
                      ? "Acknowledge incident"
                      : incident.severity === "critical"
                        ? "Resolve and lift containment"
                        : "Resolve incident"}
                  </button>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold text-sentinel-lime">
                {incident.requestId ? (
                  <button type="button" className="inline-flex items-center gap-1.5 hover:text-sentinel-text" onClick={() => onViewEvidence(incident.requestId!)}>
                    <ExternalLink className="h-3.5 w-3.5" /> SentinelOps evidence
                  </button>
                ) : null}
                {incident.externalReference ? (
                  <a className="inline-flex items-center gap-1.5 hover:text-sentinel-text" href={incident.externalReference} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> GitHub release
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
