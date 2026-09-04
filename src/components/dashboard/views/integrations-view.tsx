"use client";

import {
  Bot,
  Boxes,
  Check,
  FileKey2,
  GitBranch,
  PlugZap,
  Plus,
  RotateCcw,
  Search,
  Webhook,
  Zap,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import type { Integration } from "@/lib/types";
import { integrations } from "@/lib/demo-data";
import { GitHubDriftIncidents } from "@/components/github-drift-incidents";
import { GitHubAppConnection } from "@/components/github-app-connection";
import { SlackConnection } from "@/components/slack-connection";
import { HttpsWebhookConnection } from "@/components/https-webhook-connection";
import { PythonSDKConnection } from "@/components/python-sdk-connection";
import { AwsConnection } from "@/components/aws-connection";
import { MicrosoftConnection } from "@/components/microsoft-connection";
import { RequestIntegrationDialog } from "@/components/request-integration-dialog";
import { EmptyState } from "../common/ui-helpers";

export function IntegrationLogo({ integration }: { integration: Integration }) {
  if (integration.name === "GitHub") return <GitBranch />;
  if (integration.name === "Slack") return <Zap />;
  if (integration.name === "HTTPS Webhooks") return <Webhook />;
  if (integration.name === "AWS") return <Boxes />;
  if (integration.name === "Microsoft 365") return <FileKey2 />;
  if (integration.name === "Python SDK") return <Bot />;
  return <PlugZap />;
}

export function integrationStatusLabel(integration: Integration) {
  if (integration.status === "verified") return "Verified";
  if (integration.status === "configured") return "Configured";
  if (integration.status === "attention") return "Needs attention";
  return integration.connected ? "Connected" : "Not connected";
}

export function IntegrationsView({
  items,
  live,
  canRetryDeadLetters,
  onRetryDeadLetters,
  canAcknowledgeDrift,
  onAcknowledgeDrift,
  onResolveDrift,
  onViewEvidence,
  onRefresh,
  onNotify,
}: {
  items: Integration[];
  live: boolean;
  canRetryDeadLetters: boolean;
  onRetryDeadLetters: () => Promise<void>;
  canAcknowledgeDrift: boolean;
  onAcknowledgeDrift: (incidentId: string, note: string) => Promise<void>;
  onResolveDrift: (incidentId: string, note: string) => Promise<void>;
  onViewEvidence: (requestId: string) => void;
  onRefresh: () => Promise<void>;
  onNotify: (message: string) => void;
}) {
  const [demoItems, setDemoItems] = useState(integrations);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const visibleItems = live ? items : demoItems;
  const driftIncidents =
    visibleItems.find((item) => item.name === "GitHub")?.driftIncidents ?? [];

  const filteredItems = useMemo(() => {
    return visibleItems.filter((item) => {
      const matchesSearch = `${item.name} ${item.description} ${item.category}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (categoryFilter === "connected" && !item.connected) return false;
      if (
        categoryFilter !== "all" &&
        categoryFilter !== "connected" &&
        item.category !== categoryFilter
      ) {
        return false;
      }
      return true;
    });
  }, [visibleItems, searchQuery, categoryFilter]);

  const categories = useMemo(() => {
    const list = Array.from(new Set(visibleItems.map((i) => i.category)));
    return ["all", "connected", ...list];
  }, [visibleItems]);

  const connectedCount = visibleItems.filter((i) => i.connected).length;

  function toggle(id: string) {
    setDemoItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              connected: !item.connected,
              events: item.connected ? "Not connected" : "Connected just now",
            }
          : item,
      ),
    );
  }

  async function retryFailedNotifications() {
    setRetrying(true);
    try {
      await onRetryDeadLetters();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <main className="page">
      <div className="page-title-row">
        <div>
          <h2>Enterprise integrations</h2>
          <p>Connect the systems where AI agents read data, call APIs, and take consequential actions.</p>
        </div>
        <button className="primary-button w-full sm:w-auto justify-center" onClick={() => setRequestDialogOpen(true)}>
          <Plus /> Request integration
        </button>
      </div>

      {/* Top Metrics Summary Band */}
      <section className="mb-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-3.5 sm:p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted truncate">
              Active Connectors
            </p>
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sentinel-lime opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sentinel-lime" />
            </span>
          </div>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-semibold text-sentinel-lime">
            {connectedCount} <span className="text-xs sm:text-sm font-normal text-sentinel-muted">/ {visibleItems.length}</span>
          </p>
          <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-sentinel-muted truncate">Enforcing policy controls</p>
        </div>

        <div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-3.5 sm:p-4">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted truncate">
            GitHub Drift Guard
          </p>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-semibold text-sentinel-text truncate">
            {driftIncidents.length === 0 ? "Protected" : `${driftIncidents.length} Drift Alert`}
          </p>
          <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-sentinel-muted truncate">Release workflow guard</p>
        </div>

        <div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-3.5 sm:p-4">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted truncate">
            SIEM / ChatOps Routing
          </p>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-semibold text-sentinel-text">Active</p>
          <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-sentinel-muted truncate">Slack + Webhook outbox</p>
        </div>

        <div className="rounded-xl border border-sentinel-line bg-sentinel-surface p-3.5 sm:p-4">
          <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-sentinel-muted truncate">
            Agent SDK & APIs
          </p>
          <p className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-semibold text-sentinel-lime">Ready</p>
          <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-sentinel-muted truncate">Python SDK + HTTP REST</p>
        </div>
      </section>

      {/* Search & Filter Header */}
      <section className="mb-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <label className="search-field wide-search w-full sm:max-w-sm flex-1">
          <Search />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search integrations, tools, or categories…"
            aria-label="Search integrations"
          />
        </label>

        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scroll-touch pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`filter-chip shrink-0 ${categoryFilter === cat ? "filter-active" : ""}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === "all" ? "All" : cat === "connected" ? "Connected" : cat}
              {cat === "all" ? (
                <span>{visibleItems.length}</span>
              ) : cat === "connected" ? (
                <span>{connectedCount}</span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      {/* Integrations Grid */}
      <div className="integrations-grid">
        {filteredItems.map((integration) => (
          <article
            className={`panel integration-card ${
              expandedId === integration.id ? "integration-card-expanded" : ""
            }`}
            key={integration.id}
          >
            <div className="integration-logo">
              <IntegrationLogo integration={integration} />
            </div>
            <div className="integration-copy">
              <div className="flex items-center justify-between gap-2">
                <h3>{integration.name}</h3>
                {integration.connected || integration.status === "attention" ? (
                  <span className="connected">
                    <Check /> {integrationStatusLabel(integration)}
                  </span>
                ) : (
                  <span className="rounded-full border border-sentinel-line bg-sentinel-canvas px-2 py-0.5 text-[10px] font-medium text-sentinel-muted">
                    Available
                  </span>
                )}
              </div>
              <span className="text-[11px] font-medium text-sentinel-dim">{integration.category}</span>
              <p>{integration.description}</p>
              {integration.repository || integration.mode ? (
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-medium text-sentinel-muted">
                  {integration.repository ? (
                    <span className="rounded-md border border-sentinel-border bg-sentinel-panel-soft px-2.5 py-1">
                      {integration.repository}
                    </span>
                  ) : null}
                  {integration.mode ? (
                    <span className="rounded-md border border-sentinel-border bg-sentinel-panel-soft px-2.5 py-1">
                      {integration.mode}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="integration-footer">
              <span>{integration.events}</span>
              {integration.id === "int-python-sdk" ? (
                <button
                  className="secondary-button"
                  onClick={() =>
                    setExpandedId(expandedId === integration.id ? null : integration.id)
                  }
                >
                  {expandedId === integration.id ? "Hide Guide" : "Configure"}
                </button>
              ) : live ? (
                (integration.deadLetters ?? 0) > 0 ? (
                  <button
                    className="primary-button"
                    disabled={!canRetryDeadLetters || retrying}
                    onClick={() => void retryFailedNotifications()}
                    title={canRetryDeadLetters ? undefined : "Admin role required"}
                  >
                    <RotateCcw className={retrying ? "animate-spin" : undefined} />
                    {retrying ? "Requeueing" : `Retry ${integration.deadLetters} failed`}
                  </button>
                ) : (
                  <button
                    className={
                      expandedId === integration.id
                        ? "secondary-button"
                        : integration.connected
                        ? "secondary-button"
                        : "primary-button"
                    }
                    onClick={() =>
                      setExpandedId(expandedId === integration.id ? null : integration.id)
                    }
                  >
                    {expandedId === integration.id
                      ? "Hide settings"
                      : integration.connected
                      ? "Configure"
                      : "Connect"}
                  </button>
                )
              ) : (
                <button
                  className={
                    expandedId === integration.id
                      ? "secondary-button"
                      : integration.connected
                      ? "secondary-button"
                      : "primary-button"
                  }
                  onClick={() => {
                    if (
                      integration.name === "AWS" ||
                      integration.name === "Microsoft 365" ||
                      integration.name === "GitHub" ||
                      integration.name === "Slack" ||
                      integration.name === "HTTPS Webhooks"
                    ) {
                      setExpandedId(expandedId === integration.id ? null : integration.id);
                    } else {
                      toggle(integration.id);
                    }
                  }}
                >
                  {expandedId === integration.id
                    ? "Hide settings"
                    : integration.connected
                    ? "Configure"
                    : "Connect"}
                </button>
              )}
            </div>

            {/* Expandable Configuration Panels */}
            {expandedId === integration.id && integration.name === "GitHub" ? (
              <GitHubAppConnection
                integration={integration}
                canManage={canAcknowledgeDrift}
                onChanged={onRefresh}
                onNotify={onNotify}
              />
            ) : null}
            {expandedId === integration.id && integration.name === "Slack" ? (
              <SlackConnection
                integration={integration}
                canManage={canAcknowledgeDrift}
                onChanged={onRefresh}
                onNotify={onNotify}
              />
            ) : null}
            {expandedId === integration.id &&
            (integration.name === "HTTPS Webhooks" || integration.id === "int-https-webhooks") ? (
              <HttpsWebhookConnection
                integration={integration}
                canManage={canAcknowledgeDrift}
                onChanged={onRefresh}
                onNotify={onNotify}
              />
            ) : null}
            {expandedId === integration.id && integration.id === "int-python-sdk" ? (
              <PythonSDKConnection />
            ) : null}
            {expandedId === integration.id && integration.name === "AWS" ? (
              <AwsConnection onNotify={onNotify} />
            ) : null}
            {expandedId === integration.id && integration.name === "Microsoft 365" ? (
              <MicrosoftConnection onNotify={onNotify} />
            ) : null}
          </article>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="panel p-8 text-center space-y-3">
          <EmptyState
            icon={PlugZap}
            title="No matching integrations found"
            description="Try adjusting your search term or category filter, or request a custom connector."
          />
          <button
            className="secondary-button mx-auto mt-2"
            onClick={() => setRequestDialogOpen(true)}
          >
            <Plus /> Request custom integration
          </button>
        </div>
      )}

      <GitHubDriftIncidents
        incidents={driftIncidents}
        canAcknowledge={canAcknowledgeDrift}
        onAcknowledge={onAcknowledgeDrift}
        onResolve={onResolveDrift}
        onViewEvidence={onViewEvidence}
      />
      <RequestIntegrationDialog
        open={requestDialogOpen}
        onClose={() => setRequestDialogOpen(false)}
        onSubmitted={(integrationName) => {
          onNotify(
            `Integration request for "${integrationName}" submitted. Solutions engineering has been notified.`,
          );
        }}
      />
    </main>
  );
}
