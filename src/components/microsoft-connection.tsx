"use client";

import {
  ExternalLink,
  LoaderCircle,
  Lock,
  Save,
  ShieldCheck,
} from "lucide-react";
import React, { useState } from "react";

interface MicrosoftConnectionProps {
  onNotify?: (message: string) => void;
}

export function MicrosoftConnection({ onNotify }: MicrosoftConnectionProps) {
  const [tenantId, setTenantId] = useState("72f988bf-86f1-41af-91ab-2d7cd011db47");
  const [clientId, setClientId] = useState("499b84ac-1321-427f-aa17-267ca6975798");
  const [scopes] = useState(["Files.ReadWrite.All", "Mail.Send", "AuditLog.Read.All"]);
  const [saving, setSaving] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);

  async function handleAuthorize() {
    setAuthorizing(true);
    await new Promise((r) => setTimeout(r, 900));
    setAuthorizing(false);
    onNotify?.("Microsoft Graph API OAuth consent granted for organizational tenant.");
  }

  async function handleSave() {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    onNotify?.("Microsoft 365 security & policy settings updated.");
  }

  return (
    <div
      className="col-span-full w-full mt-4 border-t border-sentinel-line pt-4 space-y-4 animate-dialog-in text-xs"
      style={{ gridColumn: "1 / -1" }}
    >
      <div className="rounded-xl border border-sentinel-lime/30 bg-sentinel-lime/10 p-3 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-sentinel-lime shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <strong className="font-semibold text-sentinel-text">Microsoft Graph & Entra ID Integration</strong>
          <p className="mt-0.5 text-sentinel-muted text-[11px] leading-5">
            Evaluate, quarantine, and gate autonomous agent access to SharePoint, Exchange, OneDrive, and Teams data across your tenant.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block font-medium text-sentinel-muted text-[11px]">
            Entra ID Directory (Tenant) ID
            <input
              className="mt-1 h-9 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 font-mono text-xs text-sentinel-text outline-none focus:border-sentinel-lime/70 focus:ring-1 focus:ring-sentinel-lime/20"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="e.g. 72f988bf-..."
            />
          </label>
        </div>

        <div>
          <label className="block font-medium text-sentinel-muted text-[11px]">
            Application (Client) ID
            <input
              className="mt-1 h-9 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 font-mono text-xs text-sentinel-text outline-none focus:border-sentinel-lime/70 focus:ring-1 focus:ring-sentinel-lime/20"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g. 499b84ac-..."
            />
          </label>
        </div>
      </div>

      <div>
        <label className="block font-medium text-sentinel-muted text-[11px] mb-1.5">
          Guarded Graph API Scopes
        </label>
        <div className="flex flex-wrap gap-2">
          {scopes.map((scope) => (
            <span
              key={scope}
              className="inline-flex items-center gap-1 rounded-md border border-sentinel-line bg-sentinel-canvas px-2.5 py-1 font-mono text-[11px] text-sentinel-text"
            >
              <Lock className="h-3 w-3 text-sentinel-lime" /> {scope}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2.5 pt-2">
        <button
          type="button"
          className="secondary-button"
          onClick={() => void handleAuthorize()}
          disabled={authorizing || saving}
        >
          {authorizing ? <LoaderCircle className="animate-spin h-3.5 w-3.5" /> : <ExternalLink className="h-3.5 w-3.5" />}
          {authorizing ? "Authorizing…" : "Consent with Entra ID"}
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={() => void handleSave()}
          disabled={saving || authorizing}
        >
          {saving ? <LoaderCircle className="animate-spin h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Saving…" : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}
