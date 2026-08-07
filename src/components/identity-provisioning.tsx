"use client";

import { Copy, KeyRound, LoaderCircle, Save, ShieldCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";

interface IdentitySettings {
  allowedEmailDomains: string[];
  scimConfigured: boolean;
  scimTokenHint: string | null;
  scimTokenCreatedAt: string | null;
  lastScimSyncAt: string | null;
  sessionPolicy: { maxDurationMinutes: number; idleTimeoutMinutes: number };
  mfaRequiredForSensitiveActions: boolean;
  saml: { configured: boolean; enabled: boolean; idpEntityId: string | null; entryPoint: string | null; emailAttribute: string; metadataUrl: string | null };
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "Never";
}

export function IdentityProvisioning({ onNotify }: { onNotify: (message: string) => void }) {
  const [settings, setSettings] = useState<IdentitySettings | null>(null);
  const [domains, setDomains] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "token" | null>(null);
  const [sessionPolicyBusy, setSessionPolicyBusy] = useState(false);
  const [sessionMaxDuration, setSessionMaxDuration] = useState("480");
  const [sessionIdleTimeout, setSessionIdleTimeout] = useState("60");
  const [samlBusy, setSamlBusy] = useState(false);
  const [samlEntityId, setSamlEntityId] = useState("");
  const [samlEntryPoint, setSamlEntryPoint] = useState("");
  const [samlCertificate, setSamlCertificate] = useState("");
  const [samlEmailAttribute, setSamlEmailAttribute] = useState("email");
  const [samlEnabled, setSamlEnabled] = useState(false);
  const [error, setError] = useState("");
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

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
          setSessionMaxDuration(String(payload.sessionPolicy.maxDurationMinutes));
          setSessionIdleTimeout(String(payload.sessionPolicy.idleTimeoutMinutes));
          setMfaRequired(payload.mfaRequiredForSensitiveActions);
          setSamlEntityId(payload.saml.idpEntityId ?? ""); setSamlEntryPoint(payload.saml.entryPoint ?? "");
          setSamlEmailAttribute(payload.saml.emailAttribute); setSamlEnabled(payload.saml.enabled);
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

  async function saveSessionPolicy() {
    setSessionPolicyBusy(true); setError("");
    try {
      const maxDurationMinutes = Number(sessionMaxDuration);
      const idleTimeoutMinutes = Number(sessionIdleTimeout);
      const response = await fetch("/api/v1/identity/settings", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionPolicy: { maxDurationMinutes, idleTimeoutMinutes } }),
      });
      const payload = (await response.json()) as { sessionPolicy?: IdentitySettings["sessionPolicy"]; error?: string };
      if (!response.ok || !payload.sessionPolicy) throw new Error(payload.error || "Unable to save the session policy.");
      setSettings((current) => current ? { ...current, sessionPolicy: payload.sessionPolicy! } : current);
      setSessionMaxDuration(String(payload.sessionPolicy.maxDurationMinutes));
      setSessionIdleTimeout(String(payload.sessionPolicy.idleTimeoutMinutes));
      onNotify("Session-risk policy saved. It applies to new sessions immediately.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save the session policy."); }
    finally { setSessionPolicyBusy(false); }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    onNotify("Copied to clipboard.");
  }

  async function startMfaEnrollment() { setMfaBusy(true); setError(""); try { const response = await fetch("/api/v1/mfa", { method: "PUT" }); const payload = await response.json() as { secret?: string; error?: string }; if (!response.ok || !payload.secret) throw new Error(payload.error || "Unable to start MFA enrollment."); setMfaSecret(payload.secret); } catch (value) { setError(value instanceof Error ? value.message : "Unable to start MFA enrollment."); } finally { setMfaBusy(false); } }
  async function confirmMfaEnrollment() { if (!mfaSecret) return; setMfaBusy(true); setError(""); try { const response = await fetch("/api/v1/mfa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "confirm", secret: mfaSecret, code: mfaCode }) }); const payload = await response.json() as { recoveryCodes?: string[]; error?: string }; if (!response.ok || !payload.recoveryCodes) throw new Error(payload.error || "Unable to verify the authenticator code."); setRecoveryCodes(payload.recoveryCodes); setMfaSecret(null); setMfaCode(""); onNotify("Authenticator enrolled. Store the recovery codes now."); } catch (value) { setError(value instanceof Error ? value.message : "Unable to verify the authenticator code."); } finally { setMfaBusy(false); } }
  async function saveMfaRequirement() { setMfaBusy(true); setError(""); try { const response = await fetch("/api/v1/identity/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mfaRequiredForSensitiveActions: mfaRequired }) }); const payload = await response.json() as { mfaRequiredForSensitiveActions?: boolean; error?: string }; if (!response.ok || payload.mfaRequiredForSensitiveActions === undefined) throw new Error(payload.error || "Unable to update MFA enforcement."); setSettings((current) => current ? { ...current, mfaRequiredForSensitiveActions: payload.mfaRequiredForSensitiveActions! } : current); onNotify(mfaRequired ? "MFA is now required for sensitive approvals." : "MFA requirement disabled."); } catch (value) { setError(value instanceof Error ? value.message : "Unable to update MFA enforcement."); } finally { setMfaBusy(false); } }

  async function saveSaml() {
    setSamlBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/identity/saml", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ idpEntityId: samlEntityId, entryPoint: samlEntryPoint, idpCertificate: samlCertificate, emailAttribute: samlEmailAttribute, enabled: samlEnabled }) });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to save SAML configuration.");
      setSamlCertificate(""); await load(); onNotify(samlEnabled ? "SAML SSO is enabled for this organization." : "SAML SSO configuration saved in verification mode.");
    } catch (samlError) { setError(samlError instanceof Error ? samlError.message : "Unable to save SAML configuration."); }
    finally { setSamlBusy(false); }
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
      <div className="mt-5 rounded-lg border border-sentinel-line bg-sentinel-canvas/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-sentinel-text">Session-risk policy</p><p className="mt-1 max-w-2xl text-[11px] leading-5 text-sentinel-muted">Limit how long an operator can stay signed in and how long an unattended browser remains trusted. The policy applies to every new password and SAML SSO session.</p></div><span className="rounded-full border border-sentinel-line px-2 py-1 text-[10px] font-semibold uppercase text-sentinel-muted">Enforced</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-sentinel-muted">Maximum session duration (minutes)<input type="number" min="30" max="1440" className="mt-2 h-10 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sm text-sentinel-text" value={sessionMaxDuration} onChange={(event) => setSessionMaxDuration(event.target.value)} /></label><label className="text-xs text-sentinel-muted">Idle timeout (minutes)<input type="number" min="5" max="480" className="mt-2 h-10 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sm text-sentinel-text" value={sessionIdleTimeout} onChange={(event) => setSessionIdleTimeout(event.target.value)} /></label></div>
        <div className="mt-3 flex justify-end"><button className="secondary-button" disabled={sessionPolicyBusy} onClick={() => void saveSessionPolicy()}>{sessionPolicyBusy ? <LoaderCircle className="animate-spin" /> : <Save />} Save session policy</button></div>
      </div>
      {token ? <div className="mt-4 rounded-lg border border-sentinel-lime/30 bg-sentinel-lime/10 p-3"><p className="text-xs font-semibold text-sentinel-text">Copy this token now—it cannot be retrieved later.</p><div className="mt-2 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded bg-sentinel-canvas px-3 py-2 text-xs text-sentinel-text">{token}</code><button className="secondary-button" onClick={() => void copy(token)}><Copy /> Copy</button></div></div> : null}
      <div className="mt-5 rounded-lg border border-sentinel-line bg-sentinel-canvas/50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-sentinel-text">Administrator MFA</p><p className="mt-1 max-w-2xl text-[11px] leading-5 text-sentinel-muted">Use an authenticator app to protect this operator account. Secrets are encrypted server-side; recovery codes are shown once.</p></div>{!mfaSecret ? <button className="secondary-button" disabled={mfaBusy} onClick={() => void startMfaEnrollment()}>{mfaBusy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Enroll authenticator</button> : null}</div>{mfaSecret ? <div className="mt-4 rounded-lg border border-sentinel-lime/30 bg-sentinel-lime/10 p-3"><p className="text-xs font-semibold text-sentinel-text">Add this setup key to your authenticator app, then enter the six-digit code.</p><div className="mt-2 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded bg-sentinel-canvas px-3 py-2 text-xs text-sentinel-text">{mfaSecret}</code><button className="secondary-button" onClick={() => void copy(mfaSecret)}><Copy /> Copy</button></div><div className="mt-3 flex flex-wrap gap-2"><input className="h-10 w-48 rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sm text-sentinel-text" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="123456" inputMode="numeric" /><button className="primary-button" disabled={mfaBusy || mfaCode.length < 6} onClick={() => void confirmMfaEnrollment()}>{mfaBusy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Verify and enable</button></div></div> : null}{recoveryCodes ? <div className="mt-4 rounded-lg border border-sentinel-amber/30 bg-sentinel-amber/10 p-3"><p className="text-xs font-semibold text-sentinel-text">Save these recovery codes now. Each works once.</p><code className="mt-2 block whitespace-pre-wrap rounded bg-sentinel-canvas p-3 text-xs text-sentinel-text">{recoveryCodes.join("\n")}</code><button className="secondary-button mt-2" onClick={() => void copy(recoveryCodes.join("\n"))}><Copy /> Copy recovery codes</button></div> : null}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-sentinel-line pt-4"><label className="flex items-center gap-2 text-xs text-sentinel-text"><input type="checkbox" checked={mfaRequired} onChange={(event) => setMfaRequired(event.target.checked)} /> Require recent MFA for sensitive approvals</label><button className="secondary-button" disabled={mfaBusy} onClick={() => void saveMfaRequirement()}>{mfaBusy ? <LoaderCircle className="animate-spin" /> : <Save />} Save MFA enforcement</button></div></div>

      <div className="mt-5 rounded-lg border border-sentinel-line bg-sentinel-canvas/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-sentinel-text">SAML SSO connection</p><p className="mt-1 text-[11px] text-sentinel-muted">Paste your IdP metadata values. Keep verification mode on until a test login succeeds.</p></div><span className="rounded-full border border-sentinel-line px-2 py-1 text-[10px] font-semibold uppercase text-sentinel-muted">{settings?.saml.enabled ? "Enabled" : settings?.saml.configured ? "Verification mode" : "Not configured"}</span></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2"><input className="h-10 rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sm text-sentinel-text" value={samlEntityId} onChange={(e) => setSamlEntityId(e.target.value)} placeholder="IdP entity ID (URL)" /><input className="h-10 rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sm text-sentinel-text" value={samlEntryPoint} onChange={(e) => setSamlEntryPoint(e.target.value)} placeholder="IdP SSO URL" /><input className="h-10 rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sm text-sentinel-text" value={samlEmailAttribute} onChange={(e) => setSamlEmailAttribute(e.target.value)} placeholder="Email attribute, e.g. email" /><label className="flex items-center gap-2 text-xs text-sentinel-muted"><input type="checkbox" checked={samlEnabled} onChange={(e) => setSamlEnabled(e.target.checked)} /> Enable SAML SSO after verification</label></div>
        <textarea className="mt-3 min-h-28 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas p-3 font-mono text-xs text-sentinel-text" value={samlCertificate} onChange={(e) => setSamlCertificate(e.target.value)} placeholder="IdP X.509 signing certificate (PEM) — re-enter when changing SAML settings" />
        {settings?.saml.metadataUrl ? <p className="mt-2 break-all text-[11px] text-sentinel-muted">SP metadata: <span className="font-mono text-sentinel-text">{settings.saml.metadataUrl}</span></p> : null}
        <div className="mt-3 flex justify-end"><button className="secondary-button" disabled={samlBusy || !samlCertificate.trim()} onClick={() => void saveSaml()}>{samlBusy ? <LoaderCircle className="animate-spin" /> : <Save />} Save SAML connection</button></div>
      </div>
    </section>
  );
}
