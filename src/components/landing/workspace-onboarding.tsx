"use client";

import Link from "next/link";
import Script from "next/script";
import { ArrowRight, Building2, Check, LoaderCircle, Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { shouldBypassTurnstile } from "@/lib/turnstile-host";

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
      const formData = new FormData(event.currentTarget);
      const turnstileToken = formData.get("cf-turnstile-response");
      const response = await fetch("/api/v1/onboarding", {
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
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to resend verification email.");
      setResendStatus(payload.message || "If a pending account exists, a new link has been sent.");
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
    <main className="min-h-screen bg-sentinel-canvas px-4 py-14 font-sentinel text-sentinel-text sm:px-6">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
        <section>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-sentinel-lime">
            <ShieldCheck className="h-5 w-5" /> SentinelOps
          </Link>
          <p className="mt-12 text-sm font-semibold uppercase tracking-[0.18em] text-sentinel-lime">
            {invitationToken ? "Team invitation" : "Start your workspace"}
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            {invitationToken ? "Join your organization on SentinelOps." : "Put your first agent under control."}
          </h1>
          <p className="mt-5 max-w-md text-base leading-7 text-sentinel-muted">
            {invitationToken
              ? "Accept your invitation to begin governing consequential AI agent actions under enterprise safety policies."
              : "Create an organization, secure its first administrator, and begin with the release-agent safety path. Your workspace starts isolated from every other customer."}
          </p>
          <div className="mt-8 space-y-3 text-sm text-sentinel-muted">
            <p className="flex gap-3">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-lime" /> Organization-scoped records, credentials, and audit chain
            </p>
            <p className="flex gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-lime" /> Production release policy enabled from day one
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-sentinel-line bg-sentinel-surface p-6 shadow-app-2 sm:p-8">
          {invitationToken ? (
            invitationLoading ? (
              <div className="py-12 text-center text-sm text-sentinel-muted">
                <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-sentinel-lime" />
                <p className="mt-3">Validating your invitation…</p>
              </div>
            ) : invitationAccepted ? (
              <div className="py-8 text-center">
                <ShieldCheck className="mx-auto h-10 w-10 text-sentinel-lime" />
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
                  You are accepting an invitation for <strong className="text-sentinel-text">{invitationInfo.email}</strong> as an <strong className="text-sentinel-lime uppercase">{invitationInfo.role}</strong>.
                </p>
                <form className="mt-7 space-y-4" onSubmit={submitAcceptInvitation}>
                  <label className="block text-sm font-medium">
                    Your name
                    <input
                      required
                      value={acceptDisplayName}
                      onChange={(e) => setAcceptDisplayName(e.target.value)}
                      className="mt-2 h-11 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sentinel-text outline-none focus:border-sentinel-lime"
                      placeholder="Jane Doe"
                      autoFocus
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Set your password
                    <input
                      required
                      type="password"
                      minLength={12}
                      value={acceptPassword}
                      onChange={(e) => setAcceptPassword(e.target.value)}
                      className="mt-2 h-11 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sentinel-text outline-none focus:border-sentinel-lime"
                      placeholder="At least 12 characters"
                    />
                  </label>
                  {error ? <p className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
                  <button className="primary-button mt-2 w-full justify-center" disabled={submitting}>
                    {submitting ? <LoaderCircle className="animate-spin" /> : <Check />}
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
                <ShieldAlert className="mx-auto h-10 w-10 text-sentinel-amber" />
                <h2 className="mt-4 text-2xl font-bold">Verification link expired or invalid</h2>
                <p className="mt-2 text-sm text-sentinel-muted">
                  The email verification link has expired or was already used. Enter your work email below to receive a new link.
                </p>
              </div>
              <form className="mt-6 space-y-4" onSubmit={handleResendVerification}>
                <label className="block text-sm font-medium">
                  Work email
                  <input
                    required
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sentinel-text outline-none focus:border-sentinel-lime"
                    placeholder="name@company.com"
                  />
                </label>
                {resendStatus ? (
                  <p className="rounded-lg border border-sentinel-lime/30 bg-sentinel-lime/10 p-3 text-xs text-sentinel-text">
                    {resendStatus}
                  </p>
                ) : null}
                {error ? <p className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
                <button className="primary-button w-full justify-center" disabled={resendBusy || !resendEmail}>
                  {resendBusy ? <LoaderCircle className="animate-spin" /> : <Mail className="h-4 w-4" />}
                  {resendBusy ? "Sending link…" : "Resend verification link"}
                </button>
              </form>
              <div className="mt-6 text-center text-sm">
                <Link href="/get-started" className="text-sentinel-lime hover:underline">
                  Back to create workspace
                </Link>
              </div>
            </div>
          ) : verificationSent ? (
            <div className="py-8 text-center">
              <ShieldCheck className="mx-auto h-10 w-10 text-sentinel-lime" />
              <h2 className="mt-5 text-2xl font-bold">Check your work email</h2>
              <p className="mt-3 text-sm leading-6 text-sentinel-muted">
                We sent a one-time verification link to {form.email}. Open it within 24 hours to activate your workspace, then sign in.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold">Create your organization</h2>
              <p className="mt-2 text-sm text-sentinel-muted">
                Use your work email. It becomes the first administrator account.
              </p>
              <form className="mt-7 space-y-4" onSubmit={submit}>
                <label className="block text-sm font-medium">
                  Organization name
                  <input
                    required
                    value={form.organizationName}
                    onChange={(event) => setForm((current) => ({ ...current, organizationName: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sentinel-text outline-none focus:border-sentinel-lime"
                    placeholder="AtlasPay"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Your name
                  <input
                    required
                    value={form.displayName}
                    onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sentinel-text outline-none focus:border-sentinel-lime"
                    placeholder="Maya Patel"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Work email
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sentinel-text outline-none focus:border-sentinel-lime"
                    placeholder="maya@atlaspay.com"
                  />
                </label>
                <label className="block text-sm font-medium">
                  Password
                  <input
                    required
                    type="password"
                    minLength={12}
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    className="mt-2 h-11 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-sentinel-text outline-none focus:border-sentinel-lime"
                    placeholder="At least 12 characters"
                  />
                </label>
                {turnstileSiteKey ? (
                  <div className="rounded-lg border border-sentinel-line bg-sentinel-canvas p-3">
                    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
                    <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-theme="dark" data-action="workspace_onboarding" />
                    <p className="mt-2 text-xs text-sentinel-muted">Human verification protects workspace creation.</p>
                  </div>
                ) : null}
                {error ? <p className="rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p> : null}
                <button className="primary-button mt-2 w-full justify-center" disabled={submitting}>
                  {submitting ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}
                  {submitting ? "Creating secure workspace…" : "Create workspace"}
                </button>
              </form>
              <p className="mt-5 text-center text-sm text-sentinel-muted">
                Already have an account?{" "}
                <Link className="font-semibold text-sentinel-lime" href="/dashboard">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
