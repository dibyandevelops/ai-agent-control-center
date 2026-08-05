"use client";

import { LoaderCircle, MessageSquare, PlugZap, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Integration } from "@/lib/types";

export function SlackConnection({
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
  const connection = integration.slackConnection;

  async function startOAuth() {
    setBusy("connect");
    try {
      const response = await fetch("/api/v1/slack/connections/start", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        authorizeUrl?: string;
      };
      if (!response.ok || !payload.authorizeUrl) {
        throw new Error(payload.error || "Slack authorization could not be started.");
      }
      window.location.assign(payload.authorizeUrl);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "Slack authorization could not be started.");
      setBusy(null);
    }
  }

  async function request(path: string, method: "POST" | "DELETE", success: string) {
    if (
      method === "DELETE" &&
      !window.confirm("Disconnect this organization from Slack and revoke its webhook?")
    ) return;
    setBusy(path);
    try {
      const response = await fetch(path, { method });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Slack connection could not be updated.");
      await onChanged();
      onNotify(success);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "Slack connection could not be updated.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="col-span-full mt-1 rounded-xl border border-sentinel-border bg-sentinel-panel-soft/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <MessageSquare className="h-4 w-4 text-sentinel-lime" />
            Organization-scoped Slack alerts
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-sentinel-muted">
            Each customer authorizes its own workspace and channel. SentinelOps encrypts the webhook and never exposes it in the dashboard.
          </p>
        </div>
        <span className="rounded-full border border-sentinel-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sentinel-muted">
          {integration.slackAuthenticationMode === "oauth" ? "Slack OAuth" : "Migration fallback"}
        </span>
      </div>

      {connection ? (
        <div className="mt-4 rounded-lg border border-sentinel-border bg-sentinel-bg/50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{connection.teamName}</p>
              <p className="mt-1 text-[11px] text-sentinel-muted">
                #{connection.channelName.replace(/^#/, "")} · {connection.status}
                {connection.lastDeliveryAt ? ` · last delivery ${new Date(connection.lastDeliveryAt).toLocaleString()}` : ""}
              </p>
              {connection.lastError ? <p className="mt-1 text-[11px] text-red-300">{connection.lastError}</p> : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="secondary-button"
                disabled={!canManage || busy !== null}
                onClick={() => void request("/api/v1/slack/connections/test", "POST", "Slack test alert delivered.")}
              >
                {busy === "/api/v1/slack/connections/test" ? <LoaderCircle className="animate-spin" /> : <PlugZap />}
                Test
              </button>
              <button
                className="secondary-button"
                disabled={!canManage || busy !== null}
                onClick={() => void request("/api/v1/slack/connections", "DELETE", "Slack connection removed.")}
              >
                {busy === "/api/v1/slack/connections" ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                Disconnect
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {canManage ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] leading-5 text-sentinel-muted">
            Reconnecting replaces only this organization&apos;s destination and preserves its audit history.
          </p>
          <button className="primary-button" disabled={busy !== null} onClick={() => void startOAuth()} type="button">
            {busy === "connect" ? <LoaderCircle className="animate-spin" /> : <MessageSquare />}
            {connection ? "Reconnect Slack" : "Connect Slack workspace"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
