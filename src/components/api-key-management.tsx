"use client";

import {
  Check,
  Clock3,
  Copy,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wifi,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { AgentApiKey } from "@/lib/types";
import { AgentQuickstart } from "@/components/agent-quickstart";

const fieldClass =
  "mt-2 h-11 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3.5 text-sm text-sentinel-text outline-none transition placeholder:text-sentinel-dim focus:border-sentinel-lime/70 focus:ring-2 focus:ring-sentinel-lime/10";

const expirationOptions = [30, 60, 90, 180, 365] as const;

function credentialStatusLabel(status: AgentApiKey["status"]) {
  if (status === "expired") return "Expired";
  if (status === "revoked") return "Revoked";
  return "Active";
}

function credentialStatusTone(status: AgentApiKey["status"]) {
  if (status === "active") return "text-sentinel-lime";
  if (status === "expired") return "text-sentinel-amber";
  return "text-sentinel-muted";
}

function credentialStatusDot(status: AgentApiKey["status"]) {
  if (status === "active") return "bg-sentinel-lime";
  if (status === "expired") return "bg-sentinel-amber";
  return "bg-sentinel-dim";
}

function formatDate(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function fetchApiKeys() {
  const response = await fetch("/api/v1/api-keys", { cache: "no-store" });
  const payload = (await response.json()) as {
    apiKeys?: AgentApiKey[];
    error?: string;
  };
  if (!response.ok || !payload.apiKeys) {
    throw new Error(payload.error || "Unable to load API keys.");
  }
  return payload.apiKeys;
}

export function ApiKeyManagement({
  organizationName,
  onNotify,
}: {
  organizationName: string;
  onNotify: (message: string) => void;
}) {
  const [apiKeys, setApiKeys] = useState<AgentApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<{
    apiKey: AgentApiKey;
    action: "rotate" | "revoke";
  } | null>(null);
  const [revealed, setRevealed] = useState<{
    title: string;
    description: string;
    secret: string;
    apiKey: AgentApiKey;
  } | null>(null);

  const loadApiKeys = useCallback(async () => {
    try {
      const keys = await fetchApiKeys();
      setError("");
      setApiKeys(keys);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load API keys.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadInitialApiKeys() {
      try {
        const keys = await fetchApiKeys();
        if (!cancelled) setApiKeys(keys);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load API keys.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadInitialApiKeys();
    return () => {
      cancelled = true;
    };
  }, []);

  async function completeAction(expiresInDays?: number) {
    if (!actionTarget) return;
    const { apiKey, action } = actionTarget;
    setError("");
    const response = await fetch(
      `/api/v1/api-keys/${apiKey.id}${action === "rotate" ? "/rotate" : ""}`,
      action === "rotate"
        ? {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ expiresInDays }),
          }
        : { method: "DELETE" },
    );
    const payload = (await response.json()) as {
      apiKey?: AgentApiKey;
      revokedApiKeyId?: string;
      secret?: string;
      revokedAt?: string;
      error?: string;
    };
    if (!response.ok) {
      throw new Error(payload.error || `Unable to ${action} API key.`);
    }

    if (action === "rotate" && payload.apiKey && payload.secret) {
      setApiKeys((current) => [
        payload.apiKey as AgentApiKey,
        ...current.map((item) =>
          item.id === payload.revokedApiKeyId
            ? { ...item, status: "revoked" as const, revokedAt: new Date().toISOString() }
            : item,
        ),
      ]);
      setRevealed({
        title: "Rotated API key",
        description: `${apiKey.name} now has a new credential. The previous key stopped working immediately.`,
        secret: payload.secret,
        apiKey: payload.apiKey,
      });
      onNotify(`${apiKey.name} was rotated and its previous key was revoked.`);
    } else {
      setApiKeys((current) =>
        current.map((item) =>
          item.id === apiKey.id
            ? {
                ...item,
                status: "revoked" as const,
                revokedAt: payload.revokedAt || new Date().toISOString(),
              }
            : item,
        ),
      );
      onNotify(`${apiKey.name} was revoked.`);
    }
    setActionTarget(null);
  }

  const activeCount = apiKeys.filter((apiKey) => apiKey.status === "active").length;
  const expiredCount = apiKeys.filter((apiKey) => apiKey.status === "expired").length;

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h2>Agent credentials</h2>
          <p>Create and control the bearer keys agents use to request policy evaluations.</p>
        </div>
        <button className="primary-button primary-large" onClick={() => setCreateOpen(true)}>
          <Plus /> Create API key
        </button>
      </div>

      <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-app border border-sentinel-line bg-sentinel-surface px-5 py-4 shadow-app-1">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-sentinel-lime/20 bg-sentinel-lime/10 text-sentinel-lime">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <strong className="block text-sm font-semibold text-sentinel-text">
              {loading
                ? "Loading credentials"
                : `${activeCount} active ${activeCount === 1 ? "credential" : "credentials"}${expiredCount ? ` · ${expiredCount} expired` : ""}`}
            </strong>
            <span className="mt-0.5 block text-xs text-sentinel-muted">
              Every key is scoped to {organizationName}.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-sentinel-muted">
          <ShieldCheck className="h-4 w-4 text-sentinel-lime" />
          Plaintext keys are never stored by SentinelOps
        </div>
      </section>

      {error ? (
        <div className="mb-5 flex items-start gap-3 rounded-app border border-sentinel-red/30 bg-sentinel-red/10 px-4 py-3 text-sm text-red-200">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <AgentQuickstart onCreateKey={() => setCreateOpen(true)} />

      <section className="overflow-hidden rounded-app border border-sentinel-line bg-sentinel-surface shadow-app-1">
        <div className="flex items-center justify-between border-b border-sentinel-line px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-sentinel-text">API keys</h3>
            <p className="mt-1 text-xs text-sentinel-muted">Keys expire automatically. Rotate them before the deadline and revoke credentials no longer in use.</p>
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:border-sentinel-line-strong hover:text-sentinel-text"
            onClick={() => void loadApiKeys()}
            aria-label="Refresh API keys"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="grid min-h-48 place-items-center text-sm text-sentinel-muted">
            <span className="flex items-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Loading credentials…</span>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="grid min-h-52 place-items-center px-6 text-center">
            <div>
              <KeyRound className="mx-auto h-7 w-7 text-sentinel-dim" />
              <strong className="mt-3 block text-sm text-sentinel-text">No API keys yet</strong>
              <p className="mt-1 text-xs text-sentinel-muted">Create a credential to connect your first agent.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="bg-sentinel-raised/60 text-[10px] uppercase tracking-[0.12em] text-sentinel-dim">
                  <tr>
                    <th className="px-5 py-3 font-medium">Credential</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Last used</th>
                    <th className="px-4 py-3 font-medium">Expires</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-5 py-3 text-right font-medium">Controls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sentinel-line">
                  {apiKeys.map((apiKey) => (
                    <tr key={apiKey.id} className="transition hover:bg-white/[0.025]">
                      <td className="px-5 py-4">
                        <strong className="block text-sm font-medium text-sentinel-text">{apiKey.name}</strong>
                        <code className="mt-1.5 block font-mono text-[11px] text-sentinel-muted">{apiKey.keyPrefix}••••••••</code>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-2 text-xs font-medium ${credentialStatusTone(apiKey.status)}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${credentialStatusDot(apiKey.status)}`} />
                          {credentialStatusLabel(apiKey.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-sentinel-muted"><span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5" /> {formatDate(apiKey.lastUsedAt)}</span></td>
                      <td className={`px-4 py-4 text-xs ${apiKey.status === "expired" ? "font-medium text-sentinel-amber" : "text-sentinel-muted"}`}>{apiKey.expiresAt ? formatDate(apiKey.expiresAt) : "Legacy key"}</td>
                      <td className="px-4 py-4 text-xs text-sentinel-muted">{formatDate(apiKey.createdAt)}</td>
                      <td className="px-5 py-4 text-right">
                        {apiKey.status !== "revoked" ? (
                          <div className="flex items-center justify-end gap-2">
                            <button className="rounded-lg border border-sentinel-line px-3 py-2 text-xs font-semibold text-sentinel-muted transition hover:border-sentinel-line-strong hover:text-sentinel-text" onClick={() => setActionTarget({ apiKey, action: "rotate" })}>Rotate</button>
                            {apiKey.status === "active" ? <button className="rounded-lg border border-sentinel-red/30 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-sentinel-red/10" onClick={() => setActionTarget({ apiKey, action: "revoke" })}>Revoke</button> : null}
                          </div>
                        ) : (
                          <span className="text-xs text-sentinel-dim">Revoked {formatDate(apiKey.revokedAt)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-sentinel-line md:hidden">
              {apiKeys.map((apiKey) => (
                <article key={apiKey.id} className="space-y-4 px-5 py-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block truncate text-sm text-sentinel-text">{apiKey.name}</strong>
                      <code className="mt-1.5 block font-mono text-[11px] text-sentinel-muted">{apiKey.keyPrefix}••••••••</code>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${credentialStatusTone(apiKey.status)}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${credentialStatusDot(apiKey.status)}`} /> {credentialStatusLabel(apiKey.status)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs text-sentinel-muted">
                    <div><span className="mb-1 block text-[10px] uppercase tracking-wider text-sentinel-dim">Last used</span>{formatDate(apiKey.lastUsedAt)}</div>
                    <div><span className="mb-1 block text-[10px] uppercase tracking-wider text-sentinel-dim">Expires</span>{apiKey.expiresAt ? formatDate(apiKey.expiresAt) : "Legacy"}</div>
                    <div><span className="mb-1 block text-[10px] uppercase tracking-wider text-sentinel-dim">Created</span>{formatDate(apiKey.createdAt)}</div>
                  </div>
                  {apiKey.status !== "revoked" ? (
                    <div className={`grid gap-2 ${apiKey.status === "active" ? "grid-cols-2" : "grid-cols-1"}`}>
                      <button className="rounded-lg border border-sentinel-line px-3 py-2.5 text-xs font-semibold text-sentinel-muted" onClick={() => setActionTarget({ apiKey, action: "rotate" })}>Rotate</button>
                      {apiKey.status === "active" ? <button className="rounded-lg border border-sentinel-red/30 px-3 py-2.5 text-xs font-semibold text-red-300" onClick={() => setActionTarget({ apiKey, action: "revoke" })}>Revoke</button> : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {createOpen ? (
        <CreateApiKeyDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(apiKey, secret) => {
            setApiKeys((current) => [apiKey, ...current]);
            setCreateOpen(false);
            setRevealed({
              title: "API key created",
              description: `${apiKey.name} can now authenticate agent evaluation requests.`,
              secret,
              apiKey,
            });
            onNotify(`${apiKey.name} was created.`);
          }}
        />
      ) : null}
      {actionTarget ? (
        <ConfirmApiKeyActionDialog
          target={actionTarget}
          onClose={() => setActionTarget(null)}
          onConfirm={completeAction}
        />
      ) : null}
      {revealed ? (
        <SecretRevealDialog
          {...revealed}
          onClose={() => setRevealed(null)}
          onTested={(apiKeyId) => {
            setApiKeys((current) =>
              current.map((apiKey) =>
                apiKey.id === apiKeyId
                  ? { ...apiKey, lastUsedAt: new Date().toISOString() }
                  : apiKey,
              ),
            );
            onNotify("Agent credential connection verified.");
          }}
        />
      ) : null}
    </main>
  );
}

function CreateApiKeyDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (apiKey: AgentApiKey, secret: string) => void;
}) {
  const [name, setName] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, expiresInDays: Number(expiresInDays) }),
      });
      const payload = (await response.json()) as {
        apiKey?: AgentApiKey;
        secret?: string;
        error?: string;
      };
      if (!response.ok || !payload.apiKey || !payload.secret) {
        throw new Error(payload.error || "API key creation failed.");
      }
      onCreated(payload.apiKey, payload.secret);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "API key creation failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DialogShell title="Create agent API key" description="Use a descriptive name so operators know which workload owns this credential." onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <label className="block text-xs font-medium text-sentinel-muted">
          Credential name
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Production release agent" autoFocus required minLength={2} maxLength={120} />
        </label>
        <label className="block text-xs font-medium text-sentinel-muted">
          Credential lifetime
          <select className={fieldClass} value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)}>
            {expirationOptions.map((days) => <option key={days} value={days}>{days} days{days === 90 ? " · recommended" : ""}</option>)}
          </select>
          <span className="mt-2 block text-[11px] leading-5 text-sentinel-dim">The agent stops authenticating automatically at this deadline unless the key is rotated first.</span>
        </label>
        <div className="flex items-start gap-2.5 rounded-xl border border-sentinel-amber/25 bg-sentinel-amber/10 px-3.5 py-3 text-xs leading-5 text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-amber" />
          The complete key is shown once. Store it in your secret manager, never in source code.
        </div>
        {error ? <div className="rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 px-3.5 py-3 text-xs text-red-200">{error}</div> : null}
        <div className="flex justify-end gap-3 border-t border-sentinel-line pt-5">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={submitting}>{submitting ? <LoaderCircle className="animate-spin" /> : <KeyRound />}{submitting ? "Creating…" : "Create key"}</button>
        </div>
      </form>
    </DialogShell>
  );
}

function ConfirmApiKeyActionDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: { apiKey: AgentApiKey; action: "rotate" | "revoke" };
  onClose: () => void;
  onConfirm: (expiresInDays?: number) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const rotating = target.action === "rotate";

  async function confirm() {
    setLoading(true);
    setError("");
    try {
      await onConfirm(rotating ? Number(expiresInDays) : undefined);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Credential update failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogShell title={`${rotating ? "Rotate" : "Revoke"} API key`} description={`${target.apiKey.name} · ${target.apiKey.keyPrefix}••••••••`} onClose={onClose}>
      <div className="space-y-5">
        <p className="text-sm leading-6 text-sentinel-muted">
          {rotating
            ? "A new key will be generated and the current credential will stop working immediately. Update the agent before its next request."
            : "This credential will stop authenticating immediately. This action cannot be undone."}
        </p>
        {rotating ? <label className="block text-xs font-medium text-sentinel-muted">New credential lifetime<select className={fieldClass} value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)}>{expirationOptions.map((days) => <option key={days} value={days}>{days} days{days === 90 ? " · recommended" : ""}</option>)}</select></label> : null}
        <div className="flex items-start gap-2.5 rounded-xl border border-sentinel-amber/25 bg-sentinel-amber/10 px-3.5 py-3 text-xs leading-5 text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-amber" />
          Confirm the workload owner is ready for this interruption.
        </div>
        {error ? <div className="rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 px-3.5 py-3 text-xs text-red-200">{error}</div> : null}
        <div className="flex justify-end gap-3 border-t border-sentinel-line pt-5">
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className={rotating ? "primary-button" : "inline-flex h-10 items-center gap-2 rounded-xl border border-sentinel-red/40 bg-sentinel-red/10 px-4 text-xs font-semibold text-red-200 transition hover:bg-sentinel-red/20"} onClick={() => void confirm()} disabled={loading}>
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : rotating ? <RefreshCw className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
            {loading ? `${rotating ? "Rotating" : "Revoking"}…` : rotating ? "Rotate key" : "Revoke key"}
          </button>
        </div>
      </div>
    </DialogShell>
  );
}

function SecretRevealDialog({
  title,
  description,
  secret,
  apiKey,
  onClose,
  onTested,
}: {
  title: string;
  description: string;
  secret: string;
  apiKey: AgentApiKey;
  onClose: () => void;
  onTested: (apiKeyId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [testState, setTestState] = useState<
    "idle" | "testing" | "verified" | "failed"
  >("idle");
  const [testMessage, setTestMessage] = useState("");

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setError("Copy failed. Select the API key manually.");
    }
  }

  async function testConnection() {
    setTestState("testing");
    setTestMessage("");
    try {
      const response = await fetch("/api/v1/actions/evaluate", {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: `onboarding-${apiKey.id}-${crypto.randomUUID()}`,
          agent: {
            externalId: `onboarding-${apiKey.id}`,
            name: `${apiKey.name} connection check`,
            ownerEmail: "platform@example.com",
            team: "Platform Engineering",
            provider: "SentinelOps quickstart",
          },
          action: "system.health.read",
          resource: "sentinelops://credential-test",
          environment: "development",
          riskHint: "low",
          context: { onboardingTest: true },
        }),
      });
      const payload = (await response.json()) as {
        status?: string;
        requestId?: string;
        error?: string;
      };
      if (!response.ok || !payload.status || !payload.requestId) {
        throw new Error(payload.error || "Credential test failed.");
      }
      setTestState("verified");
      setTestMessage(`Connected. SentinelOps returned ${payload.status}.`);
      onTested(apiKey.id);
    } catch (testError) {
      setTestState("failed");
      setTestMessage(
        testError instanceof Error ? testError.message : "Credential test failed.",
      );
    }
  }

  return (
    <DialogShell title={title} description={description} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-start gap-2.5 rounded-xl border border-sentinel-lime/25 bg-sentinel-lime/10 px-3.5 py-3 text-xs leading-5 text-sentinel-text">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-lime" />
          Save this key now. SentinelOps stores only its SHA-256 hash and cannot show it again.
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sentinel-dim">Agent API key · shown once</span>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-sentinel-line-strong bg-sentinel-canvas p-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-2 font-mono text-xs text-sentinel-text">{secret}</code>
            <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text" onClick={() => void copySecret()} aria-label={copied ? "API key copied" : "Copy API key"}>
              {copied ? <Check className="h-4 w-4 text-sentinel-lime" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${testState === "verified" ? "border-sentinel-lime/25 bg-sentinel-lime/10" : testState === "failed" ? "border-sentinel-red/30 bg-sentinel-red/10" : "border-sentinel-line bg-sentinel-raised/50"}`}>
          <Wifi className={`mt-0.5 h-4 w-4 shrink-0 ${testState === "verified" ? "text-sentinel-lime" : testState === "failed" ? "text-red-300" : "text-sentinel-muted"}`} />
          <div className="min-w-0 flex-1">
            <strong className="block text-xs font-semibold text-sentinel-text">Verify before installing</strong>
            <p className="mt-1 text-[11px] leading-5 text-sentinel-muted">
              {testMessage || "Send a harmless development health-read through the real policy engine."}
            </p>
          </div>
          {testState !== "verified" ? (
            <button
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-sentinel-line px-2.5 text-[11px] font-semibold text-sentinel-text transition hover:border-sentinel-lime/40 disabled:cursor-wait"
              onClick={() => void testConnection()}
              disabled={testState === "testing"}
            >
              {testState === "testing" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
              {testState === "testing" ? "Testing…" : "Test connection"}
            </button>
          ) : (
            <Check className="h-4 w-4 shrink-0 text-sentinel-lime" />
          )}
        </div>
        {error ? <div className="rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 px-3.5 py-3 text-xs text-red-200">{error}</div> : null}
        <div className="flex justify-end border-t border-sentinel-line pt-5"><button className="primary-button" onClick={onClose}>I saved this key</button></div>
      </div>
    </DialogShell>
  );
}

function DialogShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-lg overflow-hidden rounded-app-lg border border-sentinel-line-strong bg-sentinel-surface shadow-app-2" role="dialog" aria-modal="true" aria-labelledby="api-key-dialog-title">
        <div className="flex items-start justify-between border-b border-sentinel-line px-6 py-5">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sentinel-lime/25 bg-sentinel-lime/10 text-sentinel-lime"><KeyRound className="h-5 w-5" /></span>
            <div className="min-w-0"><h2 id="api-key-dialog-title" className="text-lg font-semibold tracking-tight text-sentinel-text">{title}</h2><p className="mt-1 text-xs leading-5 text-sentinel-muted">{description}</p></div>
          </div>
          <button className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text" onClick={onClose} aria-label="Close dialog"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
