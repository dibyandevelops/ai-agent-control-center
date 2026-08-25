"use client";

import Link from "next/link";
import Script from "next/script";
import { ArrowRight, Building2, Check, LoaderCircle, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { shouldBypassTurnstile } from "@/lib/turnstile-host";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";

const subscribeToClient = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface InvitationInfo {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: string;
  expiresAt: string;
}

export function WorkspaceOnboarding() {
  const [form, setForm] = useState({ organizationName: "", displayName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);

  // Invitation state
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [invitationLoading, setInvitationLoading] = useState(false);
  const [invitationAccepted, setInvitationAccepted] = useState(false);
  const [acceptDisplayName, setAcceptDisplayName] = useState("");
  const [acceptPassword, setAcceptPassword] = useState("");

  const [isInvalidVerification, setIsInvalidVerification] = useState(false);

  const isClient = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("invitation");
      const verif = params.get("verification");

      if (verif === "invalid") {
        setIsInvalidVerification(true);
      }

      if (token) {
        setInvitationToken(token);
        setInvitationLoading(true);
        fetch(`/api/v1/invitations/accept?token=${encodeURIComponent(token)}`)
          .then(async (res) => {
            const data = (await res.json()) as { valid?: boolean; invitation?: InvitationInfo; error?: string };
            if (!res.ok || !data.invitation) {
              throw new Error(data.error || "This invitation is invalid or has expired.");
            }
            setInvitationInfo(data.invitation);
          })
          .catch((err) => {
            setError(err instanceof Error ? err.message : "Invalid invitation.");
          })
          .finally(() => {
            setInvitationLoading(false);
          });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const turnstileToken =
        typeof window !== "undefined" && "turnstile" in window
          ? (window as unknown as { turnstile?: { getResponse?: () => string } }).turnstile?.getResponse?.()
          : undefined;

      const response = await fetch("/api/v1/onboarding/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          turnstileToken: typeof turnstileToken === "string" ? turnstileToken : undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Workspace creation failed.");
      setVerificationSent(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Workspace creation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitAcceptInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitationToken) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/v1/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: invitationToken,
          displayName: acceptDisplayName,
          password: acceptPassword,
        }),
      });
      const payload = (await response.json()) as { accepted?: boolean; error?: string };
      if (!response.ok || !payload.accepted) {
        throw new Error(payload.error || "Failed to accept invitation.");
      }
      setInvitationAccepted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResendBusy(true);
    setResendStatus(null);
    try {
      const response = await fetch("/api/v1/onboarding/resend-verification", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to resend verification email.");
      setResendStatus("Verification email sent if the account exists and is not verified.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend verification email.");
    } finally {
      setResendBusy(false);
    }
  }

  const turnstileSiteKey =
    isClient && !shouldBypassTurnstile(window.location.hostname, process.env.NODE_ENV)
      ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      : undefined;

  return (
    <main className="min-h-screen bg-sentinel-canvas px-4 py-12 font-sentinel text-sentinel-text sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between pb-8">
          <Link href="/" className="transition hover:opacity-90">
            <BrandLogo size={32} />
          </Link>
          <ThemeToggle />
        </div>
        <div className="grid gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 dark:border-sentinel-lime/30 bg-emerald-500/10 dark:bg-sentinel-lime/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-sentinel-lime">
              <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-sentinel-lime animate-ping" />
              <span>{invitationToken ? "Team invitation" : "Enterprise Workspace Setup"}</span>
            </div>

            <h1 className="text-4xl font-black tracking-tight sm:text-5xl leading-[1.08]">
              {invitationToken ? "Join your organization on SentinelOps." : "Put your first agent under control."}
            </h1>
            <p className="text-base leading-relaxed text-sentinel-muted">
              {invitationToken
                ? "Accept your invitation to begin governing consequential AI agent actions under enterprise safety policies."
                : "Create an organization, secure your first administrator credentials, and deploy zero-trust agent governance in under two minutes."}
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3.5 rounded-2xl border border-sentinel-line bg-sentinel-surface p-4 shadow-sm">
                <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-sentinel-lime" />
                <div>
                  <strong className="text-xs font-bold text-sentinel-text">Isolated Multi-Tenant Security</strong>
                  <p className="text-xs text-sentinel-muted mt-0.5">Organization-scoped records, cryptographic keyrings, and SHA-256 audit chains.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5 rounded-2xl border border-sentinel-line bg-sentinel-surface p-4 shadow-sm">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-sentinel-lime" />
                <div>
                  <strong className="text-xs font-bold text-sentinel-text">Pre-Configured Policy Blueprints</strong>
                  <p className="text-xs text-sentinel-muted mt-0.5">Production release approval, financial threshold ceilings, and PII egress guards.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-sentinel-line bg-sentinel-surface p-7 sm:p-9 shadow-xl">
            {invitationToken ? (
              invitationLoading ? (
                <div className="py-12 text-center text-sm text-sentinel-muted">
                  <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-emerald-600 dark:text-sentinel-lime" />
                  <p className="mt-3">Validating your invitation…</p>
                </div>
              ) : invitationAccepted ? (
                <div className="py-8 text-center">
                  <ShieldCheck className="mx-auto h-10 w-10 text-emerald-600 dark:text-sentinel-lime" />
                  <h2 className="mt-5 text-2xl font-bold">Invitation accepted!</h2>
                  <p className="mt-3 text-sm leading-6 text-sentinel-muted">
                    Your account is active. You can now sign in to access the control center.
                  </p>
                  <div className="mt-6">
                    <Link href="/dashboard" className="primary-button inline-flex justify-center">
                      Sign in to dashboard
                    </Link>
                  </div>
                </div>
              ) : invitationInfo ? (
                <>
                  <h2 className="text-2xl font-bold">Join {invitationInfo.organizationName}</h2>
                  <p className="mt-2 text-sm text-sentinel-muted">
                    You are accepting an invitation for <strong className="text-sentinel-text">{invitationInfo.email}</strong> as an <strong className="text-emerald-700 dark:text-sentinel-lime uppercase">{invitationInfo.role}</strong>.
                  </p>
                  <form className="mt-7 space-y-4" onSubmit={submitAcceptInvitation}>
                    <label className="block text-xs font-bold uppercase tracking-wider text-sentinel-muted">
                      Your name
                      <input
                        required
                        value={acceptDisplayName}
                        onChange={(e) => setAcceptDisplayName(e.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none focus:border-emerald-500 dark:focus:border-sentinel-lime focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="Jane Doe"
                        autoFocus
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-sentinel-muted">
                      Set your password
                      <input
                        required
                        type="password"
                        minLength={12}
                        value={acceptPassword}
                        onChange={(e) => setAcceptPassword(e.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none focus:border-emerald-500 dark:focus:border-sentinel-lime focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="At least 12 characters"
                      />
                    </label>
                    {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-600 dark:text-red-400">{error}</p> : null}
                    <button className="primary-button mt-2 w-full justify-center text-sm font-bold py-3.5 shadow-md shadow-emerald-500/20 dark:shadow-sentinel-lime/20" disabled={submitting}>
                      {submitting ? <LoaderCircle className="animate-spin h-4 w-4" /> : <Check className="h-4 w-4" />}
                      {submitting ? "Joining workspace…" : "Accept invitation & create account"}
                    </button>
                  </form>
                </>
              ) : (
                <div className="py-8 text-center">
                  <ShieldAlert className="mx-auto h-10 w-10 text-sentinel-red" />
                  <h2 className="mt-5 text-2xl font-bold">Invalid invitation</h2>
                  <p className="mt-3 text-sm leading-6 text-sentinel-muted">
                    {error || "This invitation link is invalid, expired, or has already been accepted."}
                  </p>
                  <div className="mt-6">
                    <Link href="/get-started" className="secondary-button inline-flex">
                      Create new workspace
                    </Link>
                  </div>
                </div>
              )
            ) : isInvalidVerification ? (
              <div className="py-6">
                <div className="text-center">
                  <ShieldAlert className="mx-auto h-10 w-10 text-amber-500 dark:text-sentinel-amber" />
                  <h2 className="mt-4 text-2xl font-bold">Verification link expired or invalid</h2>
                  <p className="mt-2 text-sm text-sentinel-muted">
                    The email verification link has expired or was already used. Enter your work email below to receive a new link.
                  </p>
                </div>
                <form className="mt-6 space-y-4" onSubmit={handleResendVerification}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-sentinel-muted">
                    Work email
                    <input
                      required
                      type="email"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      className="mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none focus:border-emerald-500 dark:focus:border-sentinel-lime focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="name@company.com"
                    />
                  </label>
                  {resendStatus ? (
                    <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700 dark:text-sentinel-lime">
                      {resendStatus}
                    </p>
                  ) : null}
                  {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-600 dark:text-red-400">{error}</p> : null}
                  <button className="primary-button w-full justify-center text-sm font-bold py-3.5 shadow-md shadow-emerald-500/20 dark:shadow-sentinel-lime/20" disabled={resendBusy || !resendEmail}>
                    {resendBusy ? <LoaderCircle className="animate-spin h-4 w-4" /> : <Mail className="h-4 w-4" />}
                    {resendBusy ? "Sending link…" : "Resend verification link"}
                  </button>
                </form>
                <div className="mt-6 text-center text-sm">
                  <Link href="/get-started" className="text-emerald-700 dark:text-sentinel-lime font-semibold hover:underline">
                    Back to create workspace
                  </Link>
                </div>
              </div>
            ) : verificationSent ? (
              <div className="py-8 text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-emerald-600 dark:text-sentinel-lime" />
                <h2 className="mt-5 text-2xl font-bold">Check your work email</h2>
                <p className="mt-3 text-sm leading-6 text-sentinel-muted">
                  We sent a one-time verification link to <strong className="text-sentinel-text">{form.email}</strong>. Open it within 24 hours to activate your workspace, then sign in.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold">Create your organization</h2>
                <p className="mt-2 text-sm text-sentinel-muted">
                  Use your work email. It becomes the primary administrator account.
                </p>
                <form className="mt-7 space-y-4" onSubmit={submit}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-sentinel-muted">
                    Organization name
                    <input
                      required
                      value={form.organizationName}
                      onChange={(event) => setForm((current) => ({ ...current, organizationName: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none focus:border-emerald-500 dark:focus:border-sentinel-lime focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="AtlasPay"
                    />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-sentinel-muted">
                    Your name
                    <input
                      required
                      value={form.displayName}
                      onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none focus:border-emerald-500 dark:focus:border-sentinel-lime focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="Maya Patel"
                    />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-sentinel-muted">
                    Work email
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none focus:border-emerald-500 dark:focus:border-sentinel-lime focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="maya@atlaspay.com"
                    />
                  </label>
                  <label className="block text-xs font-bold uppercase tracking-wider text-sentinel-muted">
                    Password
                    <input
                      required
                      type="password"
                      minLength={12}
                      value={form.password}
                      onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                      className="mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none focus:border-emerald-500 dark:focus:border-sentinel-lime focus:ring-2 focus:ring-emerald-500/20"
                      placeholder="At least 12 characters"
                    />
                  </label>
                  {turnstileSiteKey ? (
                    <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas p-3">
                      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
                      <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="auto" data-action="workspace_onboarding" />
                      <p className="mt-2 text-xs text-sentinel-muted">Human verification protects workspace creation.</p>
                    </div>
                  ) : null}
                  {error ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-600 dark:text-red-400">{error}</p> : null}
                  <button className="primary-button mt-2 w-full justify-center text-sm font-bold py-3.5 shadow-md shadow-emerald-500/20 dark:shadow-sentinel-lime/20" disabled={submitting}>
                    {submitting ? <LoaderCircle className="animate-spin h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                    {submitting ? "Creating secure workspace…" : "Create workspace"}
                  </button>
                </form>
                <p className="mt-5 text-center text-xs text-sentinel-muted">
                  Already have an account?{" "}
                  <Link className="font-bold text-emerald-700 dark:text-sentinel-lime hover:underline" href="/dashboard">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
