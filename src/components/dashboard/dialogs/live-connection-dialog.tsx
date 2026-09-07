"use client";

import {
  ArrowLeft,
  Building2,
  ExternalLink,
  KeyRound,
  Mail,
  PlugZap,
  ShieldAlert,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from "lucide-react";
import Script from "next/script";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { shouldBypassTurnstile } from "@/lib/turnstile-host";
import { BrandMark } from "../navigation/sidebar";

export type DialogMode = "signin" | "register" | "forgot" | "invite";

interface TurnstileApi {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
  getResponse: (widgetId?: string) => string;
}

const subscribeToClient = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function LiveConnectionDialog({
  open,
  loading,
  error,
  onClose,
  onConnect,
  onSso,
  initialMode = "signin",
}: {
  open: boolean;
  loading: boolean;
  error: string;
  onClose: () => void;
  onConnect: (email: string, password: string, turnstileToken?: string) => Promise<void>;
  onSso: (email: string) => Promise<void>;
  initialMode?: DialogMode;
}) {
  const [mode, setMode] = useState<DialogMode>(initialMode);

  // Sign In State
  const [email, setEmail] = useState("admin@sentinelops.local");
  const [password, setPassword] = useState("");

  // Forgot Password State
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState("");

  // Register Workspace State
  const [regOrgName, setRegOrgName] = useState("");
  const [regDisplayName, setRegDisplayName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState<{
    organizationName: string;
    email: string;
    devVerificationUrl?: string;
  } | null>(null);

  // Invitation Accept State
  const [inviteToken, setInviteToken] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Cloudflare Turnstile state
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const isClient = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  const turnstileSiteKey =
    isClient &&
    !shouldBypassTurnstile(
      typeof window !== "undefined" ? window.location.hostname : "",
      process.env.NODE_ENV,
    )
      ? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
      : undefined;

  const renderTurnstile = useCallback(() => {
    if (typeof window === "undefined" || !turnstileSiteKey || !turnstileContainerRef.current) {
      return;
    }
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
        action: mode === "register" ? "workspace_registration" : "operator_signin",
        callback: (token: string) => {
          setTurnstileToken(token);
          clearErrors();
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
  }, [turnstileSiteKey, mode]);

  useEffect(() => {
    if (open && turnstileSiteKey && typeof window !== "undefined" && "turnstile" in window) {
      renderTurnstile();
    }
  }, [open, mode, turnstileSiteKey, renderTurnstile]);

  if (!open) return null;

  function clearErrors() {
    setForgotError("");
    setRegError("");
    setInviteError("");
  }

  function handleModeSwitch(newMode: DialogMode) {
    clearErrors();
    setTurnstileToken(null);
    setMode(newMode);
  }

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault();
    await onConnect(email, password, turnstileToken || undefined);
  }

  async function handleForgot(event: React.FormEvent) {
    event.preventDefault();
    setForgotBusy(true);
    setForgotError("");
    try {
      const response = await fetch("/api/v1/session/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Failed to send reset link.");
      setForgotSent(true);
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : "Failed to send reset link.");
    } finally {
      setForgotBusy(false);
    }
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setRegBusy(true);
    setRegError("");
    setRegSuccess(null);
    try {
      const response = await fetch("/api/v1/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          organizationName: regOrgName.trim(),
          displayName: regDisplayName.trim(),
          email: regEmail.trim(),
          password: regPassword,
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        organization?: { id: string; name: string };
        devVerificationUrl?: string;
      };
      if (!response.ok) {
        if (typeof window !== "undefined" && "turnstile" in window && turnstileWidgetIdRef.current) {
          try {
            const turnstile = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
            turnstile?.reset?.(turnstileWidgetIdRef.current);
            setTurnstileToken(null);
          } catch {
            // Ignored
          }
        }
        throw new Error(payload.error || "Workspace registration failed.");
      }
      setRegSuccess({
        organizationName: payload.organization?.name || regOrgName,
        email: regEmail.trim(),
        devVerificationUrl: payload.devVerificationUrl,
      });
    } catch (err) {
      setRegError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setRegBusy(false);
    }
  }

  async function handleAcceptInvite(event: React.FormEvent) {
    event.preventDefault();
    setInviteBusy(true);
    setInviteError("");
    try {
      const response = await fetch("/api/v1/invitations/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: inviteToken.trim(),
          displayName: inviteDisplayName.trim(),
          password: invitePassword,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        operator?: { email: string };
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to accept invitation.");
      }
      setInviteSuccess(true);
      if (payload.operator?.email) {
        setEmail(payload.operator.email);
      }
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Failed to accept invitation.");
    } finally {
      setInviteBusy(false);
    }
  }

  const titles: Record<DialogMode, { title: string; subtitle: string }> = {
    signin: {
      title: "Sign in to SentinelOps",
      subtitle:
        "Use your organization operator account. The browser receives an opaque, revocable HttpOnly session.",
    },
    register: {
      title: "Register Workspace",
      subtitle:
        "Create a new organization workspace and initial administrator account to start governing autonomous agents.",
    },
    forgot: {
      title: "Reset your password",
      subtitle: "Enter your operator email to receive a secure recovery link.",
    },
    invite: {
      title: "Accept Team Invitation",
      subtitle: "Join an existing workspace using your organization invite token.",
    },
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-live-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="dialog-header">
          <div className="dialog-title">
            <BrandMark small />
            <div>
              <h2 id="connect-live-title">{titles[mode].title}</h2>
              <p>{titles[mode].subtitle}</p>
            </div>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X />
          </button>
        </div>

        {/* Top Tab Switcher between Sign In and Register */}
        {mode === "signin" || mode === "register" ? (
          <div className="px-5 pt-4">
            <div className="flex rounded-lg border border-[var(--border)] bg-black/10 p-1 text-xs dark:bg-white/[0.04]">
              <button
                type="button"
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition ${
                  mode === "signin"
                    ? "bg-sentinel-lime/20 font-semibold text-sentinel-lime shadow-sm"
                    : "text-sentinel-muted hover:text-white"
                }`}
                onClick={() => handleModeSwitch("signin")}
              >
                <PlugZap className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 font-medium transition ${
                  mode === "register"
                    ? "bg-sentinel-lime/20 font-semibold text-sentinel-lime shadow-sm"
                    : "text-sentinel-muted hover:text-white"
                }`}
                onClick={() => handleModeSwitch("register")}
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>Register Workspace</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Back navigation for Forgot Password or Invite modes */}
        {mode === "forgot" || mode === "invite" ? (
          <div className="px-5 pt-3">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-sentinel-muted transition hover:text-white"
              onClick={() => handleModeSwitch("signin")}
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Back to sign in</span>
            </button>
          </div>
        ) : null}

        {/* MODE: SIGN IN */}
        {mode === "signin" && (
          <form onSubmit={handleSignIn}>
            <label>
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-sentinel-muted" />
                <span>Email</span>
              </div>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="operator@company.com"
                autoComplete="username"
                autoFocus
                required
              />
            </label>
            <label>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-sentinel-muted" />
                  <span>Password</span>
                </div>
                <button
                  type="button"
                  className="text-xs font-medium text-sentinel-lime hover:underline"
                  onClick={() => {
                    handleModeSwitch("forgot");
                    setForgotSent(false);
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 12 characters"
                autoComplete="current-password"
                minLength={12}
                required
              />
            </label>

            {/* Turnstile Bot Protection */}
            {turnstileSiteKey ? (
              <div className="rounded-xl border border-[var(--border)] bg-black/10 p-2.5 dark:bg-white/[0.03]">
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
                <p className="mt-1 text-center text-[10px] text-sentinel-muted">
                  Protected by Cloudflare Turnstile human verification
                </p>
              </div>
            ) : null}

            {error ? (
              <div className="security-note !border-sentinel-red/40 !bg-sentinel-red/10">
                <ShieldAlert />
                <div>
                  <strong>Connection failed</strong>
                  <span>{error}</span>
                </div>
              </div>
            ) : (
              <div className="security-note">
                <ShieldCheck />
                <div>
                  <strong>Server-verified session</strong>
                  <span>Live data is protected by a revocable, role-scoped account.</span>
                </div>
              </div>
            )}

            <div className="dialog-actions">
              <button type="button" className="secondary-button" onClick={onClose}>
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={loading}>
                <PlugZap /> {loading ? "Signing in…" : "Sign in"}
              </button>
            </div>

            <button
              type="button"
              className="mt-1 w-full text-center text-xs font-semibold text-sentinel-lime transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void onSso(email)}
              disabled={loading || !email}
            >
              Sign in with your organization SSO
            </button>

            {/* Registration & Invite Quick Links */}
            <div className="mt-3 flex flex-col gap-1.5 border-t border-[var(--border)] pt-3 text-[11px] text-sentinel-muted">
              <div className="flex items-center justify-between">
                <span>New to SentinelOps?</span>
                <button
                  type="button"
                  className="font-medium text-sentinel-lime hover:underline"
                  onClick={() => handleModeSwitch("register")}
                >
                  Register a workspace
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span>Have a team invitation token?</span>
                <button
                  type="button"
                  className="font-medium text-sentinel-lime hover:underline"
                  onClick={() => handleModeSwitch("invite")}
                >
                  Accept invitation
                </button>
              </div>
            </div>
          </form>
        )}

        {/* MODE: REGISTER WORKSPACE */}
        {mode === "register" && (
          <form onSubmit={handleRegister}>
            {regSuccess ? (
              <div className="flex flex-col gap-4 py-2">
                <div className="security-note !border-sentinel-lime/40 !bg-sentinel-lime/10">
                  <ShieldCheck className="text-sentinel-lime" />
                  <div>
                    <strong className="text-sentinel-lime">Workspace Created Successfully</strong>
                    <span>
                      An activation email has been delivered to <strong>{regSuccess.email}</strong>.
                      Please confirm your email to activate your workspace and sign in.
                    </span>
                  </div>
                </div>

                {regSuccess.devVerificationUrl ? (
                  <div className="rounded-lg border border-sentinel-lime/30 bg-black/20 p-3 text-xs">
                    <p className="font-semibold text-sentinel-lime">Local Development Shortcut</p>
                    <p className="mt-1 text-sentinel-muted">
                      Email dispatch in dev mode provides immediate verification:
                    </p>
                    <a
                      href={regSuccess.devVerificationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 font-semibold text-sentinel-lime hover:underline"
                    >
                      <span>Activate Account Directly (Dev Link)</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : null}

                <div className="dialog-actions">
                  <button
                    type="button"
                    className="primary-button w-full justify-center"
                    onClick={() => {
                      setEmail(regSuccess.email);
                      handleModeSwitch("signin");
                    }}
                  >
                    Proceed to Sign In
                  </button>
                </div>
              </div>
            ) : (
              <>
                <label>
                  <div className="flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-sentinel-muted" />
                    <span>Organization / Workspace Name</span>
                  </div>
                  <input
                    type="text"
                    value={regOrgName}
                    onChange={(event) => setRegOrgName(event.target.value)}
                    placeholder="e.g. Acme Autonomous Labs"
                    minLength={2}
                    maxLength={100}
                    autoFocus
                    required
                  />
                </label>

                <label>
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-sentinel-muted" />
                    <span>Your Full Name</span>
                  </div>
                  <input
                    type="text"
                    value={regDisplayName}
                    onChange={(event) => setRegDisplayName(event.target.value)}
                    placeholder="e.g. Alex Mercer"
                    minLength={2}
                    maxLength={120}
                    required
                  />
                </label>

                <label>
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-sentinel-muted" />
                    <span>Work Email</span>
                  </div>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(event) => setRegEmail(event.target.value)}
                    placeholder="alex@acme.com"
                    autoComplete="email"
                    required
                  />
                </label>

                <label>
                  <div className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-sentinel-muted" />
                    <span>Master Password</span>
                  </div>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(event) => setRegPassword(event.target.value)}
                    placeholder="At least 12 characters"
                    autoComplete="new-password"
                    minLength={12}
                    maxLength={256}
                    required
                  />
                  <span className="text-[10px] text-sentinel-muted">
                    Must be at least 12 characters. Stored using argon2id cryptographic hashing.
                  </span>
                </label>

                {/* Turnstile Bot Protection */}
                {turnstileSiteKey ? (
                  <div className="rounded-xl border border-[var(--border)] bg-black/10 p-2.5 dark:bg-white/[0.03]">
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
                    <p className="mt-1 text-center text-[10px] text-sentinel-muted">
                      Human verification protects workspace creation
                    </p>
                  </div>
                ) : null}

                {regError ? (
                  <div className="security-note !border-sentinel-red/40 !bg-sentinel-red/10">
                    <ShieldAlert />
                    <div>
                      <strong>Registration failed</strong>
                      <span>{regError}</span>
                    </div>
                  </div>
                ) : (
                  <div className="security-note">
                    <ShieldCheck />
                    <div>
                      <strong>Self-service Workspace Provisioning</strong>
                      <span>
                        Registers your enterprise tenant, provisions default SOC 2 guardrails, and creates your Administrator role.
                      </span>
                    </div>
                  </div>
                )}

                <div className="dialog-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleModeSwitch("signin")}
                  >
                    Back to sign in
                  </button>
                  <button className="primary-button" type="submit" disabled={regBusy}>
                    <UserPlus /> {regBusy ? "Creating workspace…" : "Register Workspace"}
                  </button>
                </div>

                <div className="mt-2 text-center text-[11px] text-sentinel-muted">
                  Prefer the full onboarding wizard?{" "}
                  <a
                    href="/get-started"
                    className="inline-flex items-center gap-1 font-medium text-sentinel-lime hover:underline"
                  >
                    <span>Open Onboarding Page</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </>
            )}
          </form>
        )}

        {/* MODE: FORGOT PASSWORD */}
        {mode === "forgot" && (
          <form onSubmit={handleForgot}>
            <label>
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-sentinel-muted" />
                <span>Operator Email</span>
              </div>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="operator@company.com"
                autoComplete="username"
                autoFocus
                required
              />
            </label>

            {forgotSent ? (
              <div className="security-note">
                <ShieldCheck />
                <div>
                  <strong>Recovery link sent</strong>
                  <span>
                    If an active operator account exists for {email}, a recovery link has been delivered.
                  </span>
                </div>
              </div>
            ) : null}

            {forgotError ? (
              <div className="security-note !border-sentinel-red/40 !bg-sentinel-red/10">
                <ShieldAlert />
                <div>
                  <strong>Request failed</strong>
                  <span>{forgotError}</span>
                </div>
              </div>
            ) : null}

            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleModeSwitch("signin")}
              >
                Back to sign in
              </button>
              <button className="primary-button" type="submit" disabled={forgotBusy}>
                <Mail /> {forgotBusy ? "Sending link…" : "Send reset link"}
              </button>
            </div>
          </form>
        )}

        {/* MODE: ACCEPT INVITATION */}
        {mode === "invite" && (
          <form onSubmit={handleAcceptInvite}>
            {inviteSuccess ? (
              <div className="flex flex-col gap-4 py-2">
                <div className="security-note !border-sentinel-lime/40 !bg-sentinel-lime/10">
                  <ShieldCheck className="text-sentinel-lime" />
                  <div>
                    <strong className="text-sentinel-lime">Invitation Accepted!</strong>
                    <span>Your operator account is active. You can now sign in to your workspace.</span>
                  </div>
                </div>
                <div className="dialog-actions">
                  <button
                    type="button"
                    className="primary-button w-full justify-center"
                    onClick={() => handleModeSwitch("signin")}
                  >
                    Proceed to Sign In
                  </button>
                </div>
              </div>
            ) : (
              <>
                <label>
                  <span>Invitation Token</span>
                  <input
                    type="text"
                    value={inviteToken}
                    onChange={(event) => setInviteToken(event.target.value)}
                    placeholder="Paste the invitation token from your email"
                    minLength={20}
                    autoFocus
                    required
                  />
                </label>

                <label>
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-sentinel-muted" />
                    <span>Your Full Name</span>
                  </div>
                  <input
                    type="text"
                    value={inviteDisplayName}
                    onChange={(event) => setInviteDisplayName(event.target.value)}
                    placeholder="e.g. Jordan Lee"
                    minLength={2}
                    maxLength={120}
                    required
                  />
                </label>

                <label>
                  <div className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-sentinel-muted" />
                    <span>Set Password</span>
                  </div>
                  <input
                    type="password"
                    value={invitePassword}
                    onChange={(event) => setInvitePassword(event.target.value)}
                    placeholder="At least 12 characters"
                    minLength={12}
                    maxLength={256}
                    required
                  />
                </label>

                {inviteError ? (
                  <div className="security-note !border-sentinel-red/40 !bg-sentinel-red/10">
                    <ShieldAlert />
                    <div>
                      <strong>Invitation verification failed</strong>
                      <span>{inviteError}</span>
                    </div>
                  </div>
                ) : (
                  <div className="security-note">
                    <ShieldCheck />
                    <div>
                      <strong>Team Invitation Acceptance</strong>
                      <span>
                        Joining an organization workspace inherits pre-configured RBAC and audit privileges.
                      </span>
                    </div>
                  </div>
                )}

                <div className="dialog-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => handleModeSwitch("signin")}
                  >
                    Back to sign in
                  </button>
                  <button className="primary-button" type="submit" disabled={inviteBusy}>
                    <UserPlus /> {inviteBusy ? "Joining team…" : "Accept & Join Team"}
                  </button>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
