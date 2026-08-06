"use client";

import { Copy, KeyRound, LoaderCircle, Save, ShieldCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

interface IdentitySettings {
  allowedEmailDomains: string[];
  scimConfigured: boolean;
  scimTokenHint: string | null;
  scimTokenCreatedAt: string | null;
  lastScimSyncAt: string | null;
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "Never";
}

export function IdentityProvisioning({ onNotify }: { onNotify: (message: string) => void }) {
  const [settings, setSettings] = useState<IdentitySettings | null>(null);
  const [domains, setDomains] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "token" | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/v1/identity/settings", { cache: "no-store" });
    const payload = (await response.json()) as IdentitySettings & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Unable to load identity settings.");
    setSettings(payload);
    setDomains(payload.allowedEmailDomains.join(", "));
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialSettings() {
      try {
        const response = await fetch("/api/v1/identity/settings", { cache: "no-store" });
        const payload = (await response.json()) as IdentitySettings & { error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to load identity settings.");
        if (!cancelled) {
          setSettings(payload);
          setDomains(payload.allowedEmailDomains.join(", "));
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load identity settings.");
      }
    }
    void loadInitialSettings();
    return () => { cancelled = true; };
  }, []);

  async function saveDomains() {
    setBusy("save"); setError("");
    try {
      const allowedEmailDomains = domains.split(",").map((domain) => domain.trim()).filter(Boolean);
      const response = await fetch("/api/v1/identity/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ allowedEmailDomains }) });
      const payload = (await response.json()) as { allowedEmailDomains?: string[]; error?: string };
      if (!response.ok || !payload.allowedEmailDomains) throw new Error(payload.error || "Unable to save identity domains.");
      setSettings((current) => current ? { ...current, allowedEmailDomains: payload.allowedEmailDomains! } : current);
      setDomains(payload.allowedEmailDomains.join(", "));
      onNotify("Allowed identity domains saved.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save identity domains."); }
    finally { setBusy(null); }
  }

  async function rotateToken() {
    if (settings?.scimConfigured && !window.confirm("Rotate the SCIM token? Your identity provider will need the new token immediately.")) return;
    setBusy("token"); setError("");
    try {
      const response = await fetch("/api/v1/identity/scim-token", { method: "POST" });
      const payload = (await response.json()) as { token?: string; error?: string };
      if (!response.ok || !payload.token) throw new Error(payload.error || "Unable to create SCIM token.");
      setToken(payload.token);
      await load();
      onNotify("New SCIM token created. Copy it now; it will not be shown again.");
    } catch (tokenError) { setError(tokenError instanceof Error ? tokenError.message : "Unable to create SCIM token."); }
    finally { setBusy(null); }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    onNotify("Copied to clipboard.");
  }

  return (
    <section className="mt-5 rounded-app border border-sentinel-line bg-sentinel-surface p-5 shadow-app-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="flex items-center gap-2 text-sm font-semibold text-sentinel-text"><ShieldCheck className="h-4 w-4 text-sentinel-lime" /> Enterprise identity</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-sentinel-muted">Enforce company email domains and provision operator access automatically through SCIM. SAML SSO is the next connector step and remains disabled until an identity provider is configured.</p></div>
        <span className="rounded-full border border-sentinel-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sentinel-muted">SCIM 2.0</span>
      </div>

      {error ? <div className="mt-4 flex gap-2 rounded-lg border border-sentinel-red/30 bg-sentinel-red/10 px-3 py-2 text-xs text-red-200"><ShieldAlert className="h-4 w-4 shrink-0" />{error}</div> : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-sentinel-line bg-sentinel-canvas/50 p-4">
          <label className="text-xs font-semibold text-sentinel-text">Allowed identity domains</label>
          <p className="mt-1 text-[11px] leading-5 text-sentinel-muted">Comma-separated domains. Leave blank during setup; once set, manual and SCIM-provisioned users must match.</p>
          <input className="mt-3 h-10 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sm text-sentinel-text outline-none focus:border-sentinel-lime" value={domains} onChange={(event) => setDomains(event.target.value)} placeholder="aperturelabs.com, example.com" />
          <div className="mt-3 flex justify-end"><button className="secondary-button" disabled={busy !== null} onClick={() => void saveDomains()}>{busy === "save" ? <LoaderCircle className="animate-spin" /> : <Save />} Save domains</button></div>
        </div>
        <div className="rounded-lg border border-sentinel-line bg-sentinel-canvas/50 p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-sentinel-text">SCIM provisioning token</p><p className="mt-1 text-[11px] text-sentinel-muted">{settings?.scimConfigured ? `Active · ending ${settings.scimTokenHint ?? ""}` : "Not created"}</p></div><KeyRound className="h-5 w-5 text-sentinel-lime" /></div>
          <p className="mt-3 text-[11px] text-sentinel-muted">Endpoint: <span className="break-all font-mono text-sentinel-text">/api/v1/scim/v2/Users</span></p>
          <p className="mt-1 text-[11px] text-sentinel-muted">Last SCIM sync: {formatDate(settings?.lastScimSyncAt ?? null)}</p>
          <div className="mt-3 flex justify-end"><button className="secondary-button" disabled={busy !== null} onClick={() => void rotateToken()}>{busy === "token" ? <LoaderCircle className="animate-spin" /> : <KeyRound />}{settings?.scimConfigured ? "Rotate token" : "Create token"}</button></div>
        </div>
      </div>
      {token ? <div className="mt-4 rounded-lg border border-sentinel-lime/30 bg-sentinel-lime/10 p-3"><p className="text-xs font-semibold text-sentinel-text">Copy this token now—it cannot be retrieved later.</p><div className="mt-2 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded bg-sentinel-canvas px-3 py-2 text-xs text-sentinel-text">{token}</code><button className="secondary-button" onClick={() => void copy(token)}><Copy /> Copy</button></div></div> : null}
    </section>
  );
}
