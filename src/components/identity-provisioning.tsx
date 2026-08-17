"use client";

import { Copy, KeyRound, LoaderCircle, Save, ShieldCheck, ShieldAlert, Trash2 } from "lucide-react";
import Image from "next/image";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

interface IdentitySettings {
  allowedEmailDomains: string[];
  scimConfigured: boolean;
  scimTokenHint: string | null;
  scimTokenCreatedAt: string | null;
  lastScimSyncAt: string | null;
  sessionPolicy: { maxDurationMinutes: number; idleTimeoutMinutes: number };
  mfaRequiredForSensitiveActions: boolean;
  securityDigest: { channels: Array<"slack" | "email">; hourUtc: number };
  saml: {
    configured: boolean;
    enabled: boolean;
    enforced: boolean;
    idpEntityId: string | null;
    entryPoint: string | null;
    emailAttribute: string;
    certExpiresAt: string | null;
    metadataUrl: string | null;
  };
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
  const [samlEnforced, setSamlEnforced] = useState(false);
  const [error, setError] = useState("");
  const [mfaSecret, setMfaSecret] = useState<string | null>(null);
  const [mfaOtpAuthUrl, setMfaOtpAuthUrl] = useState<string | null>(null);
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [mfaStatus, setMfaStatus] = useState<{ enabled: boolean; enabledAt: string | null; lastVerifiedAt: string | null } | null>(null);
  const [showRecoveryRegeneration, setShowRecoveryRegeneration] = useState(false);
  const [recoveryVerificationCode, setRecoveryVerificationCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [digestChannels, setDigestChannels] = useState<Array<"slack" | "email">>(["slack", "email"]);
  const [digestHour, setDigestHour] = useState("8");
  const [digestBusy, setDigestBusy] = useState(false);

  async function load() {
    const response = await fetch("/api/v1/identity/settings", { cache: "no-store" });
    const payload = (await response.json()) as IdentitySettings & { error?: string };
    if (!response.ok) throw new Error(payload.error || "Unable to load identity settings.");
    setSettings(payload);
    setDomains(payload.allowedEmailDomains.join(", "));
    setSamlEnforced(payload.saml.enforced);
    setSamlEnabled(payload.saml.enabled);
  }

  useEffect(() => {
    let cancelled = false;
    async function loadInitialSettings() {
      try {
        const [response, mfaResponse] = await Promise.all([fetch("/api/v1/identity/settings", { cache: "no-store" }), fetch("/api/v1/mfa", { cache: "no-store" })]);
        const payload = (await response.json()) as IdentitySettings & { error?: string };
        const mfaPayload = (await mfaResponse.json()) as { enabled: boolean; enabledAt: string | null; lastVerifiedAt: string | null; error?: string };
        if (!response.ok) throw new Error(payload.error || "Unable to load identity settings.");
        if (!cancelled) {
          setSettings(payload);
          setDomains(payload.allowedEmailDomains.join(", "));
          setSessionMaxDuration(String(payload.sessionPolicy.maxDurationMinutes));
          setSessionIdleTimeout(String(payload.sessionPolicy.idleTimeoutMinutes));
          setMfaRequired(payload.mfaRequiredForSensitiveActions);
          if (mfaResponse.ok) setMfaStatus(mfaPayload);
          setDigestChannels(payload.securityDigest.channels); setDigestHour("8");
          setSamlEntityId(payload.saml.idpEntityId ?? ""); setSamlEntryPoint(payload.saml.entryPoint ?? "");
          setSamlEmailAttribute(payload.saml.emailAttribute); setSamlEnabled(payload.saml.enabled);
          setSamlEnforced(payload.saml.enforced);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load identity settings.");
      }
    }
    void loadInitialSettings();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!mfaOtpAuthUrl) return () => { active = false; };
    void QRCode.toDataURL(mfaOtpAuthUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#f5f7fa", light: "#11171d" },
    }).then((value) => { if (active) setMfaQrCode(value); }).catch(() => { if (active) setError("Unable to generate the MFA QR code. Use the setup key instead."); });
    return () => { active = false; };
  }, [mfaOtpAuthUrl]);

  async function saveDomains() {
    setBusy("save"); setError("");
    try {
      const parsed = domains.split(",").map((d) => d.trim()).filter(Boolean);
      const response = await fetch("/api/v1/identity/settings", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ allowedEmailDomains: parsed }),
      });
      const payload = (await response.json()) as { allowedEmailDomains?: string[]; error?: string };
      if (!response.ok || !payload.allowedEmailDomains) throw new Error(payload.error || "Unable to save email domains.");
      setSettings((current) => current ? { ...current, allowedEmailDomains: payload.allowedEmailDomains! } : current);
      setDomains(payload.allowedEmailDomains.join(", "));
      onNotify("Allowed email domains saved.");
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Unable to save email domains."); }
    finally { setBusy(null); }
  }

  async function rotateToken() {
    setBusy("token"); setError("");
    try {
      const response = await fetch("/api/v1/identity/scim-token", { method: "POST" });
      const payload = (await response.json()) as { token?: string; hint?: string; createdAt?: string; error?: string };
      if (!response.ok || !payload.token) throw new Error(payload.error || "Unable to rotate SCIM token.");
      setToken(payload.token);
      setSettings((current) => current ? { ...current, scimConfigured: true, scimTokenHint: payload.hint ?? current.scimTokenHint, scimTokenCreatedAt: payload.createdAt ?? current.scimTokenCreatedAt } : current);
      onNotify("SCIM token rotated. Store it securely.");
    } catch (rotateError) { setError(rotateError instanceof Error ? rotateError.message : "Unable to rotate SCIM token."); }
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

  async function startMfaEnrollment() { setMfaBusy(true); setError(""); setMfaQrCode(null); setRecoveryCodes(null); try { const response = await fetch("/api/v1/mfa", { method: "PUT" }); const payload = await response.json() as { secret?: string; otpauthUrl?: string; error?: string }; if (!response.ok || !payload.secret || !payload.otpauthUrl) throw new Error(payload.error || "Unable to start MFA enrollment."); setMfaSecret(payload.secret); setMfaOtpAuthUrl(payload.otpauthUrl); } catch (value) { setError(value instanceof Error ? value.message : "Unable to start MFA enrollment."); } finally { setMfaBusy(false); } }
  async function confirmMfaEnrollment() { if (!mfaSecret) return; setMfaBusy(true); setError(""); try { const response = await fetch("/api/v1/mfa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "confirm", secret: mfaSecret, code: mfaCode }) }); const payload = await response.json() as { recoveryCodes?: string[]; error?: string }; if (!response.ok || !payload.recoveryCodes) throw new Error(payload.error || "Unable to verify the authenticator code."); setRecoveryCodes(payload.recoveryCodes); setMfaStatus({ enabled: true, enabledAt: new Date().toISOString(), lastVerifiedAt: new Date().toISOString() }); setMfaSecret(null); setMfaOtpAuthUrl(null); setMfaCode(""); onNotify("Authenticator enrolled. Store the recovery codes now."); } catch (value) { setError(value instanceof Error ? value.message : "Unable to verify the authenticator code."); } finally { setMfaBusy(false); } }
  async function regenerateRecoveryCodes() { setMfaBusy(true); setError(""); try { const response = await fetch("/api/v1/mfa/recovery-codes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: recoveryVerificationCode }) }); const payload = await response.json() as { recoveryCodes?: string[]; error?: string }; if (!response.ok || !payload.recoveryCodes) throw new Error(payload.error || "Unable to regenerate recovery codes."); setRecoveryCodes(payload.recoveryCodes); setRecoveryVerificationCode(""); setShowRecoveryRegeneration(false); onNotify("New recovery codes generated. Previous codes no longer work."); } catch (value) { setError(value instanceof Error ? value.message : "Unable to regenerate recovery codes."); } finally { setMfaBusy(false); } }
  async function saveMfaRequirement() { setMfaBusy(true); setError(""); try { const response = await fetch("/api/v1/identity/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mfaRequiredForSensitiveActions: mfaRequired }) }); const payload = await response.json() as { mfaRequiredForSensitiveActions?: boolean; error?: string }; if (!response.ok || payload.mfaRequiredForSensitiveActions === undefined) throw new Error(payload.error || "Unable to update MFA enforcement."); setSettings((current) => current ? { ...current, mfaRequiredForSensitiveActions: payload.mfaRequiredForSensitiveActions! } : current); onNotify(mfaRequired ? "MFA is now required for sensitive approvals." : "MFA requirement disabled."); } catch (value) { setError(value instanceof Error ? value.message : "Unable to update MFA enforcement."); } finally { setMfaBusy(false); } }
  async function saveDigestPreferences() { setDigestBusy(true); setError(""); try { const response = await fetch("/api/v1/identity/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ securityDigest: { channels: digestChannels, hourUtc: Number(digestHour) } }) }); const payload = await response.json() as { securityDigest?: IdentitySettings["securityDigest"]; error?: string }; if (!response.ok || !payload.securityDigest) throw new Error(payload.error || "Unable to save digest preferences."); setSettings((current) => current ? { ...current, securityDigest: payload.securityDigest! } : current); onNotify("Security digest preferences saved."); } catch (value) { setError(value instanceof Error ? value.message : "Unable to save digest preferences."); } finally { setDigestBusy(false); } }

  async function saveSaml() {
    setSamlBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/identity/saml", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          idpEntityId: samlEntityId,
          entryPoint: samlEntryPoint,
          idpCertificate: samlCertificate,
          emailAttribute: samlEmailAttribute,
          enabled: samlEnabled,
          enforced: samlEnforced,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to save SAML configuration.");
      setSamlCertificate(""); await load();
      onNotify(samlEnforced ? "SAML SSO is enforced for this organization." : samlEnabled ? "SAML SSO is enabled." : "SAML configuration saved.");
    } catch (samlError) { setError(samlError instanceof Error ? samlError.message : "Unable to save SAML configuration."); }
    finally { setSamlBusy(false); }
  }

  async function disableSamlConnection() {
    setSamlBusy(true); setError("");
    try {
      const response = await fetch("/api/v1/identity/saml", { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to disable SAML SSO.");
      setSamlEnabled(false);
      setSamlEnforced(false);
      await load();
      onNotify("SAML SSO connection disabled.");
    } catch (disableError) {
      setError(disableError instanceof Error ? disableError.message : "Unable to disable SAML SSO.");
    } finally {
      setSamlBusy(false);
    }
  }

  return (
    <section className="mt-5 rounded-app border border-sentinel-line bg-sentinel-surface p-5 shadow-app-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h3 className="flex items-center gap-2 text-sm font-semibold text-sentinel-text"><ShieldCheck className="h-4 w-4 text-sentinel-lime" /> Enterprise identity</h3><p className="mt-1 max-w-2xl text-xs leading-5 text-sentinel-muted">Enforce company email domains and provision operator access automatically through SCIM. SAML SSO provides enterprise identity provider integration.</p></div>
        <span className="rounded-full border border-sentinel-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-sentinel-muted">SCIM 2.0 & SAML</span>
      </div>

      {error ? <div className="mt-4 flex gap-2 rounded-lg border border-sentinel-red/30 bg-sentinel-red/10 px-3 py-2 text-xs text-red-200"><ShieldAlert className="h-4 w-4 shrink-0" />{error}</div> : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-sentinel-line bg-sentinel-canvas/50 p-4">
          <label className="text-xs font-semibold text-sentinel-text">Allowed identity domains</label>
          <p className="mt-1 text-[11px] leading-5 text-sentinel-muted">Comma-separated domains. Leave blank during setup; once set, manual, invited, and SCIM-provisioned users must match.</p>
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
      <div className="mt-5 rounded-lg border border-sentinel-line bg-sentinel-canvas/50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-sentinel-text">Administrator MFA</p><p className="mt-1 max-w-2xl text-[11px] leading-5 text-sentinel-muted">Use an authenticator app to protect this operator account. Secrets are encrypted server-side; recovery codes are shown once.</p></div>{!mfaSecret ? <button className="secondary-button" disabled={mfaBusy} onClick={() => void startMfaEnrollment()}>{mfaBusy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}{mfaStatus?.enabled ? "Enroll a new authenticator" : "Enroll authenticator"}</button> : null}</div>{mfaStatus ? <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]"><span className={mfaStatus.enabled ? "font-semibold text-sentinel-lime" : "font-semibold text-sentinel-muted"}>{mfaStatus.enabled ? "Authenticator enrolled" : "No authenticator enrolled"}</span>{mfaStatus.enabledAt ? <span className="text-sentinel-muted">Enabled {formatDate(mfaStatus.enabledAt)}</span> : null}{mfaStatus.lastVerifiedAt ? <span className="text-sentinel-muted">Last verified {formatDate(mfaStatus.lastVerifiedAt)}</span> : null}</div> : null}{mfaSecret ? <div className="mt-4 rounded-lg border border-sentinel-lime/30 bg-sentinel-lime/10 p-3"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="shrink-0 rounded-md border border-sentinel-line bg-sentinel-canvas p-2">{mfaQrCode ? <Image src={mfaQrCode} alt="Scan this QR code with your authenticator app" width={160} height={160} unoptimized /> : <div className="flex h-40 w-40 items-center justify-center text-center text-xs text-sentinel-muted">Generating secure QR code…</div>}</div><div className="min-w-0"><p className="text-xs font-semibold text-sentinel-text">Scan this QR code with your authenticator app.</p><p className="mt-1 text-[11px] leading-5 text-sentinel-muted">The QR code is generated privately in your browser. If scanning is unavailable, use the setup key below.</p><div className="mt-3 flex gap-2"><code className="min-w-0 flex-1 overflow-x-auto rounded bg-sentinel-canvas px-3 py-2 text-xs text-sentinel-text">{mfaSecret}</code><button className="secondary-button" onClick={() => void copy(mfaSecret)}><Copy /> Copy</button></div></div></div><div className="mt-3 flex flex-wrap gap-2"><input className="h-10 w-48 rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sm text-sentinel-text" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} placeholder="123456" inputMode="numeric" /><button className="primary-button" disabled={mfaBusy || mfaCode.length < 6} onClick={() => void confirmMfaEnrollment()}>{mfaBusy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Verify and enable</button></div></div> : null}{recoveryCodes ? <div className="mt-4 rounded-lg border border-sentinel-amber/30 bg-sentinel-amber/10 p-3"><p className="text-xs font-semibold text-sentinel-text">Save these recovery codes now. Each works once.</p><code className="mt-2 block whitespace-pre-wrap rounded bg-sentinel-canvas p-3 text-xs text-sentinel-text">{recoveryCodes.join("\n")}</code><button className="secondary-button mt-2" onClick={() => void copy(recoveryCodes.join("\n"))}><Copy /> Copy recovery codes</button></div> : null}{mfaStatus?.enabled && !mfaSecret ? <div className="mt-4 border-t border-sentinel-line pt-4">{showRecoveryRegeneration ? <div className="rounded-lg border border-sentinel-amber/30 bg-sentinel-amber/10 p-3"><p className="text-xs font-semibold text-sentinel-text">Generate new recovery codes</p><p className="mt-1 text-[11px] text-sentinel-muted">Verify with your authenticator first. This immediately invalidates all previous recovery codes.</p><div className="mt-3 flex flex-wrap gap-2"><input className="h-10 w-52 rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sm text-sentinel-text" value={recoveryVerificationCode} onChange={(event) => setRecoveryVerificationCode(event.target.value)} placeholder="Authenticator code" inputMode="numeric" /><button className="secondary-button" disabled={mfaBusy || recoveryVerificationCode.length < 6} onClick={() => void regenerateRecoveryCodes()}>{mfaBusy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />} Verify and replace</button><button className="text-xs text-sentinel-muted" onClick={() => { setShowRecoveryRegeneration(false); setRecoveryVerificationCode(""); }}>Cancel</button></div></div> : <button className="text-xs font-medium text-sentinel-lime" onClick={() => setShowRecoveryRegeneration(true)}>Regenerate recovery codes</button>}</div> : null}<div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-sentinel-line pt-4"><label className="flex items-center gap-2 text-xs text-sentinel-text"><input type="checkbox" checked={mfaRequired} onChange={(event) => setMfaRequired(event.target.checked)} /> Require recent MFA for sensitive approvals</label><button className="secondary-button" disabled={mfaBusy} onClick={() => void saveMfaRequirement()}>{mfaBusy ? <LoaderCircle className="animate-spin" /> : <Save />} Save MFA enforcement</button></div></div>

      <div className="mt-5 rounded-lg border border-sentinel-line bg-sentinel-canvas/50 p-4"><p className="text-xs font-semibold text-sentinel-text">Security digest delivery</p><p className="mt-1 text-[11px] text-sentinel-muted">Choose delivery channels. The current hosting plan sends the daily digest at 08:00 UTC.</p><div className="mt-3 flex flex-wrap items-center gap-4"><label className="text-xs text-sentinel-text"><input type="checkbox" checked={digestChannels.includes("slack")} onChange={(event) => setDigestChannels((current) => event.target.checked ? Array.from(new Set<"slack" | "email">([...current, "slack"])) : current.filter((channel) => channel !== "slack"))} /> Slack</label><label className="text-xs text-sentinel-text"><input type="checkbox" checked={digestChannels.includes("email")} onChange={(event) => setDigestChannels((current) => event.target.checked ? Array.from(new Set<"slack" | "email">([...current, "email"])) : current.filter((channel) => channel !== "email"))} /> Email</label><span className="text-xs text-sentinel-muted">Daily at <span className="font-medium text-sentinel-text">08:00 UTC</span></span><button className="secondary-button" disabled={digestBusy || !digestChannels.length} onClick={() => void saveDigestPreferences()}>{digestBusy ? <LoaderCircle className="animate-spin" /> : <Save />} Save delivery</button></div></div>

      <div className="mt-5 rounded-lg border border-sentinel-line bg-sentinel-canvas/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-sentinel-text">SAML SSO connection</p>
            <p className="mt-1 text-[11px] text-sentinel-muted">Paste your IdP metadata values. Keep verification mode on until a test login succeeds.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-sentinel-line px-2 py-1 text-[10px] font-semibold uppercase text-sentinel-muted">
              {settings?.saml.enforced ? "Enforced" : settings?.saml.enabled ? "Enabled" : settings?.saml.configured ? "Verification mode" : "Not configured"}
            </span>
            {settings?.saml.configured ? (
              <button
                className="secondary-button text-xs text-sentinel-red"
                disabled={samlBusy}
                onClick={() => void disableSamlConnection()}
                title="Disable SAML SSO connection"
              >
                <Trash2 className="h-3.5 w-3.5" /> Disable
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <input className="h-10 rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sm text-sentinel-text" value={samlEntityId} onChange={(e) => setSamlEntityId(e.target.value)} placeholder="IdP entity ID (URL)" />
          <input className="h-10 rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sm text-sentinel-text" value={samlEntryPoint} onChange={(e) => setSamlEntryPoint(e.target.value)} placeholder="IdP SSO URL" />
          <input className="h-10 rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sm text-sentinel-text" value={samlEmailAttribute} onChange={(e) => setSamlEmailAttribute(e.target.value)} placeholder="Email attribute, e.g. email" />
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs text-sentinel-text">
              <input type="checkbox" checked={samlEnabled} onChange={(e) => setSamlEnabled(e.target.checked)} /> Enable SAML SSO
            </label>
            <label className="flex items-center gap-2 text-xs text-sentinel-text">
              <input type="checkbox" checked={samlEnforced} onChange={(e) => setSamlEnforced(e.target.checked)} disabled={!samlEnabled} /> Enforce SAML SSO (blocks password login)
            </label>
          </div>
        </div>
        <textarea className="mt-3 min-h-28 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas p-3 font-mono text-xs text-sentinel-text" value={samlCertificate} onChange={(e) => setSamlCertificate(e.target.value)} placeholder="IdP X.509 signing certificate (PEM) — re-enter when changing SAML settings" />
        {settings?.saml.certExpiresAt ? (
          <p className="mt-2 text-[11px] text-sentinel-muted">
            IdP Certificate valid until: <span className="font-semibold text-sentinel-text">{formatDate(settings.saml.certExpiresAt)}</span>
          </p>
        ) : null}
        {settings?.saml.metadataUrl ? <p className="mt-2 break-all text-[11px] text-sentinel-muted">SP metadata: <span className="font-mono text-sentinel-text">{settings.saml.metadataUrl}</span></p> : null}
        <div className="mt-3 flex justify-end"><button className="secondary-button" disabled={samlBusy || !samlCertificate.trim()} onClick={() => void saveSaml()}>{samlBusy ? <LoaderCircle className="animate-spin" /> : <Save />} Save SAML connection</button></div>
      </div>
    </section>
  );
}
