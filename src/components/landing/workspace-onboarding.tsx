"use client";

import Link from "next/link";
import Script from "next/script";
import { ArrowRight, Building2, Check, LoaderCircle, Mail, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { shouldBypassTurnstile } from "@/lib/turnstile-host";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { InteractivePolicySandbox } from "@/components/landing/interactive-policy-sandbox";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";

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

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
  getResponse: (widgetId?: string) => string;
}

export function WorkspaceOnboarding() {
  const [form, setForm] = useState({ organizationName: "", displayName: "", email: "", password: "" });
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>("pilot");
  const [selectedInterval, setSelectedInterval] = useState<"month" | "year">("month");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resendBusy, setResendBusy] = useState(false);

  // Turnstile state and refs
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

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

  const turnstileSiteKey =
    isClient && !shouldBypassTurnstile(typeof window !== "undefined" ? window.location.hostname : "", process.env.NODE_ENV)
      ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      : undefined;

  const renderTurnstile = useCallback(() => {
    if (typeof window === "undefined" || !turnstileSiteKey || !turnstileContainerRef.current) return;
    const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
    if (!turnstile) return;

    if (turnstileWidgetIdRef.current) {
      try {
        turnstile.remove(turnstileWidgetIdRef.current);
      } catch {
        // Ignored
      }
      turnstileWidgetIdRef.current = null;
    }

    try {
      turnstileContainerRef.current.innerHTML = "";
      const widgetId = turnstile.render(turnstileContainerRef.current, {
        sitekey: turnstileSiteKey,
        theme: "auto",
        action: "workspace_onboarding",
        callback: (token: string) => {
          setTurnstileToken(token);
          setError("");
        },
        "expired-callback": () => {
          setTurnstileToken(null);
        },
        "error-callback": () => {
          setTurnstileToken(null);
        },
      });
      turnstileWidgetIdRef.current = widgetId;
    } catch (err) {
      console.warn("[Turnstile] Render warning:", err);
    }
  }, [turnstileSiteKey]);

  useEffect(() => {
    if (turnstileSiteKey && typeof window !== "undefined" && "turnstile" in window) {
      renderTurnstile();
    }
  }, [turnstileSiteKey, renderTurnstile]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("invitation");
      const verif = params.get("verification");
      const planParam = params.get("plan");
      const intervalParam = params.get("interval");

      if (planParam === "pro" || planParam === "enterprise" || planParam === "pilot") {
        setSelectedPlan(planParam);
      }
      if (intervalParam === "year" || intervalParam === "month") {
        setSelectedInterval(intervalParam);
      }

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
    setError("");

    // If Turnstile is active, ensure we have a valid token before submitting
    let activeToken = turnstileToken;
    if (turnstileSiteKey && !activeToken) {
      const turnstile = typeof window !== "undefined" ? (window as unknown as { turnstile?: TurnstileApi }).turnstile : undefined;
      const responseToken =
        turnstile?.getResponse?.(turnstileWidgetIdRef.current ?? undefined) ||
        turnstileContainerRef.current?.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]')?.value;
      if (responseToken) {
        activeToken = responseToken;
        setTurnstileToken(responseToken);
      } else {
        setError("Please complete the human verification checkbox before continuing.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          planCode: selectedPlan,
          billingInterval: selectedInterval,
          turnstileToken: typeof activeToken === "string" && activeToken ? activeToken : undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        // Reset turnstile on failure so user can immediately retry
        if (typeof window !== "undefined" && "turnstile" in window && turnstileWidgetIdRef.current) {
          try {
            const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
            turnstile?.reset?.(turnstileWidgetIdRef.current);
            setTurnstileToken(null);
          } catch {
            // Ignored
          }
        }
        throw new Error(payload.error || "Workspace creation failed.");
      }
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
                  <p className="text-xs text-sentinel-muted mt-0.5">Production templates for funds transfer, DB mutations, and GitHub releases.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5 rounded-2xl border border-sentinel-line bg-sentinel-surface p-4 shadow-sm">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-sentinel-lime" />
                <div>
                  <strong className="text-xs font-bold text-sentinel-text">Instant SDK Integration</strong>
                  <p className="text-xs text-sentinel-muted mt-0.5">Two lines of code for LangChain, Python decorators, or REST webhooks.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-sentinel-line bg-sentinel-surface p-6 sm:p-8 shadow-xl">
            {selectedPlan !== "pilot" && (
              <div className="mb-6 rounded-2xl border border-emerald-500/30 dark:border-sentinel-lime/30 bg-emerald-500/10 dark:bg-sentinel-lime/10 p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-sentinel-lime flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-sentinel-text flex items-center gap-1.5">
                      <span>{planCatalog[selectedPlan].name} Workspace Activation</span>
                      <span className="text-[10px] rounded-full bg-emerald-600 dark:bg-sentinel-lime text-white dark:text-sentinel-canvas font-black px-2 py-0.2 uppercase">
                        Selected
                      </span>
                    </div>
                    <div className="text-[11px] text-sentinel-muted mt-0.5">
                      {selectedInterval === "year" ? "Billed Annually (Save 20%)" : "Billed Monthly"} • {planCatalog[selectedPlan].agents ?? "Unlimited"} Agents & {planCatalog[selectedPlan].auditRetentionDays}-day retention
                    </div>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-600 dark:text-sentinel-lime shrink-0">
                  ${selectedInterval === "year" ? planCatalog[selectedPlan].priceAnnual : planCatalog[selectedPlan].priceMonthly}/mo
                </span>
              </div>
            )}

            {isInvalidVerification ? (
              <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-800 dark:text-amber-300">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <span>Invalid or expired verification link</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-amber-700/90 dark:text-amber-300/90">
                  This activation link is either invalid or has already expired. If your workspace was not verified, request a new link below.
                </p>

                <form className="mt-4 flex flex-col sm:flex-row gap-2" onSubmit={handleResendVerification}>
                  <input
                    required
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="Enter your registration email"
                    className="h-10 flex-1 rounded-xl border border-amber-500/30 bg-sentinel-canvas px-3 text-xs text-sentinel-text outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={resendBusy}
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-amber-600 px-4 text-xs font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
                  >
                    {resendBusy ? "Sending…" : "Resend Link"}
                  </button>
                </form>
                {resendStatus ? (
                  <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium">{resendStatus}</p>
                ) : null}
              </div>
            ) : null}

            {invitationToken ? (
              invitationLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <LoaderCircle className="h-8 w-8 animate-spin text-emerald-600 dark:text-sentinel-lime" />
                  <p className="mt-4 text-sm font-semibold text-sentinel-muted">Validating invitation credentials…</p>
                </div>
              ) : invitationAccepted ? (
                <div className="text-center py-8">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-sentinel-lime border border-emerald-500/20">
                    <Check className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 text-2xl font-bold">Invitation accepted!</h2>
                  <p className="mt-3 text-sm leading-6 text-sentinel-muted">
                    Your operator account has been created for <strong className="text-sentinel-text">{invitationInfo?.organizationName}</strong>. You can now sign in to your dashboard.
                  </p>
                  <Link
                    href="/dashboard"
                    className="primary-button mt-6 inline-flex w-full justify-center text-sm font-bold py-3.5 shadow-md shadow-emerald-500/20 dark:shadow-sentinel-lime/20"
                  >
                    <span>Sign in to Dashboard</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : invitationInfo ? (
                <>
                  <h2 className="text-2xl font-bold">Accept team invitation</h2>
                  <p className="mt-2 text-sm text-sentinel-muted">
                    You have been invited to join <strong className="text-sentinel-text">{invitationInfo.organizationName}</strong> as an <strong className="text-sentinel-text uppercase text-xs tracking-wider">{invitationInfo.role}</strong>.
                  </p>
                  <form className="mt-7 space-y-4" onSubmit={submitAcceptInvitation}>
                    <label className="block text-xs font-bold uppercase tracking-wider text-sentinel-muted">
                      Email Address
                      <input
                        disabled
                        value={invitationInfo.email}
                        className="mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas/50 px-3.5 text-sm text-sentinel-muted outline-none cursor-not-allowed"
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-sentinel-muted">
                      Your name
                      <input
                        required
                        value={acceptDisplayName}
                        onChange={(e) => setAcceptDisplayName(e.target.value)}
                        className="mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none focus:border-emerald-500 dark:focus:border-sentinel-lime focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="Sarah Connor"
                      />
                    </label>
                    <label className="block text-xs font-bold uppercase tracking-wider text-sentinel-muted">
                      Choose Password
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
                      {submitting ? <LoaderCircle className="animate-spin h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                      {submitting ? "Joining organization…" : "Join organization"}
                    </button>
                  </form>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                    <ShieldAlert className="h-7 w-7" />
                  </div>
                  <h2 className="mt-5 text-2xl font-bold">Invalid invitation</h2>
                  <p className="mt-3 text-sm leading-6 text-sentinel-muted">
                    {error || "This invitation link is invalid or has expired. Please request a new invitation from your administrator."}
                  </p>
                  <Link
                    href="/"
                    className="primary-button mt-6 inline-flex w-full justify-center text-sm font-bold py-3.5"
                  >
                    <span>Return to Home</span>
                  </Link>
                </div>
              )
            ) : verificationSent ? (
              <div className="text-center py-8">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-sentinel-lime border border-emerald-500/20">
                  <Mail className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-2xl font-bold">Check your email</h2>
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
                      <Script
                        id="cf-turnstile-script"
                        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                        strategy="afterInteractive"
                        onLoad={renderTurnstile}
                      />
                      <div
                        ref={turnstileContainerRef}
                        className="flex min-h-[65px] items-center justify-center overflow-hidden"
                      />
                      <p className="mt-2 text-center text-xs text-sentinel-muted">
                        Human verification protects workspace creation.
                      </p>
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

        {/* Live Interactive Policy Simulator Preview */}
        <div className="mt-16 pt-12 border-t border-sentinel-line">
          <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-sentinel-lime">
                <ShieldCheck className="h-3.5 w-3.5" />
                Live Zero-Trust Engine
              </div>
              <h2 className="text-2xl font-bold tracking-tight mt-1 text-sentinel-text">
                Test the Policy Engine in Real-Time
              </h2>
              <p className="text-xs text-sentinel-muted mt-1 max-w-xl">
                Experience sub-20ms policy enforcement, Slack 4-Eyes cryptographic approvals, and immutable SHA-256 seal generation before creating your workspace.
              </p>
            </div>
            <Link
              href="/docs/connecting-agents"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-sentinel-lime hover:underline transition shrink-0"
            >
              <span>Explore Developer Docs</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <InteractivePolicySandbox />
        </div>
      </div>
    </main>
  );
}
