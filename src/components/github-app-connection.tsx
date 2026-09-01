"use client";

import { GitBranch, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { MfaVerificationDialog } from "@/components/mfa-verification-dialog";
import type { Integration } from "@/lib/types";

export function GitHubAppConnection({
  integration,
  canManage,
  onChanged,
  onNotify,
}: {
  integration: Integration;
  canManage: boolean;
  onChanged: () => Promise<void>;
  onNotify: (message: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [mfaPromptOpen, setMfaPromptOpen] = useState(false);
  const connections = integration.githubConnections ?? [];

  async function request(path: string) {
    setBusy(path);
    try {
      const response = await fetch(path, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "GitHub connection could not be updated.");
      await onChanged();
      onNotify("GitHub App repositories synchronized for this organization.");
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "GitHub connection could not be updated.");
    } finally {
      setBusy(null);
    }
  }

  async function startInstallation() {
    setBusy("install");
    try {
      const response = await fetch("/api/v1/github/installations/start", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        installUrl?: string;
      };
      if (!response.ok || !payload.installUrl) {
        throw new Error(payload.error || "GitHub installation could not be started.");
      }
      window.location.assign(payload.installUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : "GitHub installation could not be started.";
      if (message.includes("Recent MFA verification")) {
        setMfaPromptOpen(true);
      } else {
        onNotify(message);
      }
      setBusy(null);
    }
  }

  return (
    <section className="col-span-full mt-1 rounded-xl border border-sentinel-border bg-sentinel-panel-soft/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-sentinel-text">
            <ShieldCheck className="h-4 w-4 text-sentinel-lime" />
            Organization-scoped access
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-sentinel-muted">
            SentinelOps requests a short-lived token only when a governed release runs. Personal access tokens are not stored here.
          </p>
        </div>
        <span className="rounded-full border border-sentinel-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sentinel-muted">
          {integration.authenticationMode === "github_app" ? "GitHub App" : "Migration fallback"}
        </span>
      </div>

      {connections.map((connection) => (
        <div className="mt-4 rounded-lg border border-sentinel-border bg-sentinel-bg/50 p-3" key={connection.id}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold text-sentinel-text">
                <GitBranch className="h-4 w-4 text-sentinel-lime" />
                <span className="truncate">{connection.accountLogin}</span>
                <span className="text-[10px] font-normal uppercase text-sentinel-muted">{connection.accountType}</span>
              </div>
              <p className="mt-1 text-[11px] text-sentinel-muted">
                Installation {connection.installationId} · {connection.repositories.filter((item) => item.enabled).length} repositories
              </p>
            </div>
            <button
              className="secondary-button"
              disabled={!canManage || busy !== null}
              onClick={() => void request(`/api/v1/github/connections/${connection.id}/sync`)}
              title={canManage ? "Refresh repositories from GitHub" : "Admin role required"}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
              Sync
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {connection.repositories.filter((item) => item.enabled).map((repository) => (
              <a
                className="max-w-full truncate rounded-md border border-sentinel-border px-2.5 py-1 text-[11px] text-sentinel-muted transition hover:border-sentinel-lime/50 hover:text-sentinel-text"
                href={`https://github.com/${repository.fullName}`}
                key={repository.id}
                rel="noreferrer"
                target="_blank"
              >
                {repository.fullName}{repository.private ? " · private" : ""}
              </a>
            ))}
          </div>
        </div>
      ))}

      {canManage ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] leading-5 text-sentinel-muted">
            GitHub verifies your installation access before SentinelOps links any repositories.
          </p>
          <button className="primary-button" disabled={busy !== null} onClick={() => void startInstallation()} type="button">
            {busy ? <LoaderCircle className="animate-spin" /> : <GitBranch />}
            Install or connect GitHub App
          </button>
        </div>
      ) : null}
      {mfaPromptOpen ? (
        <MfaVerificationDialog
          actionLabel="connect this GitHub App"
          onClose={() => setMfaPromptOpen(false)}
          onVerified={startInstallation}
        />
      ) : null}
    </section>
  );
}
