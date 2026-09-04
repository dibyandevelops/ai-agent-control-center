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
import { TablePagination } from "@/components/table-pagination";
import { CreateApiKeyDialog } from "@/components/credentials/dialogs/create-api-key-dialog";
import { ConfirmApiKeyActionDialog } from "@/components/credentials/dialogs/confirm-api-key-dialog";
import { SecretRevealDialog } from "@/components/credentials/dialogs/secret-reveal-dialog";

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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

  const paginatedApiKeys = apiKeys.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

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
        <button className="primary-button primary-large w-full sm:w-auto justify-center" onClick={() => setCreateOpen(true)}>
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
        <div className="mb-5 flex items-start gap-3 rounded-app border border-sentinel-red/30 bg-sentinel-red/10 px-4 py-3 text-sm text-red-700 dark:text-red-200">
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
                  {paginatedApiKeys.map((apiKey) => (
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
                            {apiKey.status === "active" ? <button className="rounded-lg border border-sentinel-red/30 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-300 transition hover:bg-sentinel-red/10" onClick={() => setActionTarget({ apiKey, action: "revoke" })}>Revoke</button> : null}
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
              {paginatedApiKeys.map((apiKey) => (
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 text-xs text-sentinel-muted">
                    <div><span className="mb-1 block text-[10px] uppercase tracking-wider text-sentinel-dim">Last used</span><span className="truncate block">{formatDate(apiKey.lastUsedAt)}</span></div>
                    <div><span className="mb-1 block text-[10px] uppercase tracking-wider text-sentinel-dim">Expires</span><span className="truncate block">{apiKey.expiresAt ? formatDate(apiKey.expiresAt) : "Legacy"}</span></div>
                    <div className="col-span-2 sm:col-span-1"><span className="mb-1 block text-[10px] uppercase tracking-wider text-sentinel-dim">Created</span><span className="truncate block">{formatDate(apiKey.createdAt)}</span></div>
                  </div>
                  {apiKey.status !== "revoked" ? (
                    <div className={`grid gap-2 ${apiKey.status === "active" ? "grid-cols-2" : "grid-cols-1"}`}>
                      <button className="rounded-lg border border-sentinel-line px-3 py-2.5 text-xs font-semibold text-sentinel-muted" onClick={() => setActionTarget({ apiKey, action: "rotate" })}>Rotate</button>
                      {apiKey.status === "active" ? <button className="rounded-lg border border-sentinel-red/30 px-3 py-2.5 text-xs font-semibold text-red-600 dark:text-red-300" onClick={() => setActionTarget({ apiKey, action: "revoke" })}>Revoke</button> : null}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
            <TablePagination
              currentPage={currentPage}
              totalItems={apiKeys.length}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="credentials"
            />
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
