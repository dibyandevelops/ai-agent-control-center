"use client";

import { LoaderCircle, MessageSquare, PlugZap, Save, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Integration, SlackConnection as SlackConnectionType } from "@/lib/types";

const eventOptions = [
  ["action.approval_requested", "Action approvals"],
  ["action.execution_failed", "Execution failures"],
  ["policy.activation", "Policy governance"],
  ["release.draft_governance_requested", "Release governance"],
  ["github.release_drift_detected", "GitHub drift"],
  ["github.app_lifecycle_alert", "GitHub App security"],
] as const;

const severities = ["info", "low", "medium", "high", "critical"] as const;

function SlackDestinationCard({
  connection,
  canManage,
  onChanged,
  onNotify,
}: {
  connection: SlackConnectionType;
  canManage: boolean;
  onChanged: () => Promise<void>;
  onNotify: (message: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(connection.isDefault);
  const [eventTypes, setEventTypes] = useState(connection.eventTypes);
  const [minimumSeverity, setMinimumSeverity] = useState(connection.minimumSeverity);

  async function request(method: "POST" | "PATCH" | "DELETE", success: string) {
    if (method === "DELETE" && !window.confirm(`Remove #${connection.channelName.replace(/^#/, "")} from SentinelOps? Slack access is revoked when this is the workspace's last destination.`)) return;
    setBusy(method);
    try {
      const path = method === "POST" ? "/api/v1/slack/connections/test" : "/api/v1/slack/connections";
      const response = await fetch(path, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId: connection.id, isDefault, eventTypes, minimumSeverity }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Slack destination could not be updated.");
      await onChanged();
      onNotify(success);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "Slack destination could not be updated.");
    } finally {
      setBusy(null);
    }
  }

  function toggleEvent(eventType: string) {
    setEventTypes((current) => current.includes(eventType)
      ? current.filter((value) => value !== eventType)
      : [...current, eventType]);
  }

  return (
    <div className="rounded-lg border border-sentinel-border bg-sentinel-bg/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">{connection.teamName} · #{connection.channelName.replace(/^#/, "")}</p>
            {connection.isDefault ? (
              <span className="rounded-full border border-sentinel-lime/30 bg-sentinel-lime/10 px-2 py-0.5 text-[9px] font-semibold uppercase text-sentinel-lime">Safe default</span>
            ) : null}
          </div>
          <p className="mt-1 break-words text-[11px] text-sentinel-muted">
            {connection.status}{connection.lastDeliveryAt ? ` · last delivery ${new Date(connection.lastDeliveryAt).toLocaleString()}` : ""}
          </p>
          {connection.lastError ? <p className="mt-1 break-words text-[11px] text-red-300">{connection.lastError}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button" disabled={!canManage || busy !== null} onClick={() => void request("POST", `Test delivered to #${connection.channelName.replace(/^#/, "")}.`)}>
            {busy === "POST" ? <LoaderCircle className="animate-spin" /> : <PlugZap />} Test
          </button>
          <button className="secondary-button" disabled={!canManage || busy !== null} onClick={() => void request("DELETE", "Slack destination removed.")}>
            {busy === "DELETE" ? <LoaderCircle className="animate-spin" /> : <Trash2 />} Disconnect
          </button>
        </div>
      </div>

      <div className="mt-4 border-t border-sentinel-border pt-3">
        <label className="flex items-center gap-2 text-xs font-medium text-white">
          <input type="checkbox" checked={isDefault} disabled={!canManage || connection.isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
          Use as the organization&apos;s safe default
        </label>
        {isDefault ? (
          <p className="mt-2 text-[11px] leading-5 text-sentinel-muted">Receives every alert that does not match a specialized destination.</p>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_180px]">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-sentinel-muted">Event types</p>
              <div className="flex flex-wrap gap-2">
                {eventOptions.map(([value, label]) => (
                  <label key={value} className="flex items-center gap-1.5 rounded-md border border-sentinel-border px-2 py-1.5 text-[11px] text-sentinel-muted">
                    <input type="checkbox" checked={eventTypes.includes(value)} disabled={!canManage} onChange={() => toggleEvent(value)} /> {label}
                  </label>
                ))}
              </div>
            </div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-sentinel-muted">
              Minimum severity
              <select className="mt-2 w-full rounded-md border border-sentinel-border bg-sentinel-panel px-3 py-2 text-xs capitalize text-white" value={minimumSeverity} disabled={!canManage} onChange={(event) => setMinimumSeverity(event.target.value as typeof minimumSeverity)}>
                {severities.map((severity) => <option key={severity} value={severity}>{severity}</option>)}
              </select>
            </label>
          </div>
        )}
        {canManage ? (
          <div className="mt-3 flex justify-end">
            <button className="secondary-button" disabled={busy !== null || (!isDefault && eventTypes.length === 0)} onClick={() => void request("PATCH", "Slack routing rules saved.")}>
              {busy === "PATCH" ? <LoaderCircle className="animate-spin" /> : <Save />} Save routing
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SlackConnection({ integration, canManage, onChanged, onNotify }: {
  integration: Integration;
  canManage: boolean;
  onChanged: () => Promise<void>;
  onNotify: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const connections = integration.slackConnections ?? [];

  async function startOAuth() {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/slack/connections/start", { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; authorizeUrl?: string };
      if (!response.ok || !payload.authorizeUrl) throw new Error(payload.error || "Slack authorization could not be started.");
      window.location.assign(payload.authorizeUrl);
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "Slack authorization could not be started.");
      setBusy(false);
    }
  }

  return (
    <section className="col-span-full mt-1 rounded-xl border border-sentinel-border bg-sentinel-panel-soft/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><MessageSquare className="h-4 w-4 text-sentinel-lime" /> Organization-scoped Slack routing</div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-sentinel-muted">Connect multiple destinations, route specialized security events by severity, and retain a tenant-safe fallback channel.</p>
        </div>
        <span className="rounded-full border border-sentinel-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sentinel-muted">{connections.length} destination{connections.length === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-4 grid gap-3">
        {connections.map((connection) => <SlackDestinationCard key={`${connection.id}:${connection.updatedAt}`} connection={connection} canManage={canManage} onChanged={onChanged} onNotify={onNotify} />)}
        {connections.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-sentinel-border p-4 text-xs text-sentinel-muted"><ShieldCheck className="h-5 w-5 text-sentinel-lime" /> The first connected channel becomes this organization&apos;s safe default.</div>
        ) : null}
      </div>

      {canManage ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] leading-5 text-sentinel-muted">Slack asks you to select one channel per authorization. Repeat this step to add another destination.</p>
          <button className="primary-button" disabled={busy} onClick={() => void startOAuth()} type="button">{busy ? <LoaderCircle className="animate-spin" /> : <MessageSquare />} Add Slack destination</button>
        </div>
      ) : null}
    </section>
  );
}
