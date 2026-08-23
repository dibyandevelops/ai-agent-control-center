"use client";

import { LoaderCircle, Plus, RefreshCw, ShieldCheck, Trash2, Webhook } from "lucide-react";
import { useState } from "react";
import { MfaVerificationDialog } from "@/components/mfa-verification-dialog";
import type { HttpsWebhook, Integration } from "@/lib/types";

export function HttpsWebhookConnection({
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
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [name, setName] = useState("");
  const [destinationUrl, setDestinationUrl] = useState("");
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const webhooks = integration.httpsWebhooks ?? [];

  async function run(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      const message = error instanceof Error ? error.message : "HTTPS webhook request failed.";
      if (message.toLowerCase().includes("recent mfa")) {
        setPendingAction(() => action);
        setMfaPromptOpen(true);
        return;
      }
      onNotify(message);
    }
  }

  async function createWebhook() {
    setBusy("create");
    try {
      const response = await fetch("/api/v1/https-webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, destinationUrl }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        signingSecret?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Webhook destination could not be created.");
      setName("");
      setDestinationUrl("");
      setRevealedSecret(payload.signingSecret ?? null);
      await onChanged();
      onNotify("Signed HTTPS webhook created. Copy the signing secret now; it is shown only once.");
    } finally {
      setBusy(null);
    }
  }

  async function request(path: string, method: string, success: string, body?: unknown) {
    setBusy(path);
    try {
      const response = await fetch(path, {
        method,
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        signingSecret?: string;
      };
      if (!response.ok) throw new Error(payload.error || success);
      if (payload.signingSecret) setRevealedSecret(payload.signingSecret);
      await onChanged();
      onNotify(success);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="col-span-full mt-1 rounded-xl border border-sentinel-border bg-sentinel-panel-soft/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Webhook className="h-4 w-4 text-sentinel-lime" />
            Signed HTTPS webhooks
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-sentinel-muted">
            Push organization-scoped governance events to a SIEM or SOAR endpoint. SentinelOps signs every body with HMAC-SHA256 and blocks private or loopback destinations.
          </p>
        </div>
        <span className="rounded-full border border-sentinel-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sentinel-muted">
          {webhooks.length} destination{webhooks.length === 1 ? "" : "s"}
        </span>
      </div>

      {revealedSecret ? (
        <div className="mt-4 rounded-lg border border-sentinel-lime/40 bg-sentinel-lime/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sentinel-lime">Signing secret shown once</p>
          <code className="mt-2 block break-all text-xs text-white">{revealedSecret}</code>
          <p className="mt-2 text-[11px] text-sentinel-muted">
            Verify deliveries with header <code>x-sentinelops-signature</code> over <code>timestamp.body</code>.
          </p>
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        {webhooks.map((webhook) => (
          <WebhookCard
            busy={busy}
            canManage={canManage}
            key={webhook.id}
            onDisable={() => void run(() => request(`/api/v1/https-webhooks/${webhook.id}`, "PATCH", "Webhook disabled.", { enabled: false }))}
            onEnable={() => void run(() => request(`/api/v1/https-webhooks/${webhook.id}`, "PATCH", "Webhook enabled.", { enabled: true }))}
            onRevoke={() => void run(() => request(`/api/v1/https-webhooks/${webhook.id}`, "DELETE", "Webhook revoked."))}
            onRotate={() => void run(() => request(`/api/v1/https-webhooks/${webhook.id}/rotate`, "POST", "Signing secret rotated. Copy the new secret now."))}
            onTest={() => void run(() => request(`/api/v1/https-webhooks/${webhook.id}/test`, "POST", "Test delivery accepted by the destination."))}
            webhook={webhook}
          />
        ))}
      </div>

      {canManage ? (
        <form
          className="mt-4 grid gap-3 rounded-lg border border-dashed border-sentinel-border p-3 md:grid-cols-[1fr_2fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            void run(createWebhook);
          }}
        >
          <input
            className="rounded-md border border-sentinel-border bg-sentinel-panel px-3 py-2 text-xs text-white"
            onChange={(event) => setName(event.target.value)}
            placeholder="SIEM production"
            value={name}
          />
          <input
            className="rounded-md border border-sentinel-border bg-sentinel-panel px-3 py-2 text-xs text-white"
            onChange={(event) => setDestinationUrl(event.target.value)}
            placeholder="https://siem.example.com/sentinelops"
            value={destinationUrl}
          />
          <button className="primary-button" disabled={busy !== null || name.trim().length < 2 || !destinationUrl} type="submit">
            {busy === "create" ? <LoaderCircle className="animate-spin" /> : <Plus />}
            Add destination
          </button>
        </form>
      ) : null}

      {mfaPromptOpen ? (
        <MfaVerificationDialog
          actionLabel="manage HTTPS webhooks"
          onClose={() => {
            setMfaPromptOpen(false);
            setPendingAction(null);
          }}
          onVerified={async () => {
            const action = pendingAction;
            setMfaPromptOpen(false);
            setPendingAction(null);
            if (action) await action();
          }}
        />
      ) : null}
    </section>
  );
}

function WebhookCard({
  webhook,
  canManage,
  busy,
  onEnable,
  onDisable,
  onRotate,
  onTest,
  onRevoke,
}: {
  webhook: HttpsWebhook;
  canManage: boolean;
  busy: string | null;
  onEnable: () => void;
  onDisable: () => void;
  onRotate: () => void;
  onTest: () => void;
  onRevoke: () => void;
}) {
  return (
    <div className="rounded-lg border border-sentinel-border bg-sentinel-bg/50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-white">{webhook.name}</p>
            <span className="rounded-full border border-sentinel-border px-2 py-0.5 text-[9px] font-semibold uppercase text-sentinel-muted">
              {webhook.enabled ? "enabled" : "paused"}
            </span>
          </div>
          <p className="mt-1 break-all text-[11px] text-sentinel-muted">{webhook.destinationUrl}</p>
          <p className="mt-1 text-[11px] text-sentinel-muted">
            Secret {webhook.secretPrefix}…{webhook.lastDeliveredAt ? ` · last delivery ${new Date(webhook.lastDeliveredAt).toLocaleString()}` : ""}
          </p>
          {webhook.lastError ? <p className="mt-1 text-[11px] text-red-300">{webhook.lastError}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="secondary-button" disabled={!canManage || busy !== null} onClick={onTest} type="button">
            {busy?.includes("/test") ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Test
          </button>
          <button className="secondary-button" disabled={!canManage || busy !== null} onClick={onRotate} type="button">
            {busy?.includes("/rotate") ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Rotate
          </button>
          {webhook.enabled ? (
            <button className="secondary-button" disabled={!canManage || busy !== null} onClick={onDisable} type="button">Pause</button>
          ) : (
            <button className="secondary-button" disabled={!canManage || busy !== null} onClick={onEnable} type="button">Enable</button>
          )}
          <button className="secondary-button" disabled={!canManage || busy !== null} onClick={onRevoke} type="button">
            {busy?.includes(webhook.id) && busy.endsWith(webhook.id) ? <LoaderCircle className="animate-spin" /> : <Trash2 />} Revoke
          </button>
        </div>
      </div>
    </div>
  );
}
