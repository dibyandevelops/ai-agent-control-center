"use client";

import {
  Activity,
  ArrowDownToLine,
  Bot,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Filter,
  Layers,
  LoaderCircle,
  Radio,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import type { Agent, AuditEvent } from "@/lib/types";
import { TablePagination } from "@/components/table-pagination";
import { displayTime, EmptyState } from "../common/ui-helpers";

export function ActivityView({
  events,
  agents,
}: {
  events: AuditEvent[];
  agents: Agent[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Derive unique agent names from events & registered agents
  const availableAgents = useMemo(() => {
    const set = new Set<string>();
    agents.forEach((a) => set.add(a.name));
    events.forEach((e) => {
      if (e.agent) set.add(e.agent);
    });
    return Array.from(set).sort();
  }, [agents, events]);

  // Metrics calculation
  const totalEvents = events.length;
  const blockedCount = events.filter((e) => e.result === "Blocked" || e.result === "Failed").length;
  const allowedCount = events.filter(
    (e) => e.result === "Allowed" || e.result === "Approved" || e.result === "Succeeded",
  ).length;
  const passRate = totalEvents > 0 ? ((allowedCount / totalEvents) * 100).toFixed(1) : "100.0";
  const uniqueActiveAgents = useMemo(() => {
    return new Set(events.map((e) => e.agent)).size;
  }, [events]);

  // Filter logic
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        event.agent.toLowerCase().includes(q) ||
        event.action.toLowerCase().includes(q) ||
        event.detail.toLowerCase().includes(q) ||
        (event.requestId && event.requestId.toLowerCase().includes(q)) ||
        event.id.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        event.result.toLowerCase() === statusFilter.toLowerCase();

      const matchesAgent =
        agentFilter === "all" ||
        event.agent.toLowerCase() === agentFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesAgent;
    });
  }, [events, searchQuery, statusFilter, agentFilter]);

  const paginatedEvents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredEvents.slice(startIndex, startIndex + pageSize);
  }, [filteredEvents, currentPage, pageSize]);

  const handleCopy = (text: string, type: "id" | "json") => {
    try {
      navigator.clipboard?.writeText(text);
      if (type === "id") {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      } else {
        setCopiedJson(true);
        setTimeout(() => setCopiedJson(false), 2000);
      }
    } catch {
      // Ignore clipboard error
    }
  };

  return (
    <main className="page activity-page">
      {/* Page Title & Live Heartbeat */}
      <div className="page-title-row">
        <div>
          <h2>Agent Activity & Telemetry</h2>
          <p>Real-time operational stream of autonomous agent executions, tool invocations, and policy evaluations.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-sentinel-line bg-sentinel-surface/80 px-3 py-1 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sentinel-lime opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-sentinel-lime"></span>
            </span>
            <span className="font-mono text-sentinel-lime font-medium text-[11px]">TELEMETRY ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Telemetry Metrics Band */}
      <section className="metrics-band">
        <div className="metric">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sentinel-line bg-sentinel-canvas/70 text-sentinel-lime shadow-sm">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <span>Total Invocations</span>
            <strong>{totalEvents}</strong>
            <small>Recorded telemetry events</small>
          </div>
        </div>
        <div className="metric">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sentinel-line bg-sentinel-canvas/70 text-sentinel-accent shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <span>Policy Pass Rate</span>
            <strong>{passRate}%</strong>
            <small>{allowedCount} compliant executions</small>
          </div>
        </div>
        <div className="metric">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sentinel-line bg-sentinel-canvas/70 text-red-500 shadow-sm">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <span>Guarded Interceptions</span>
            <strong className="text-red-500 dark:text-red-400">{blockedCount}</strong>
            <small>Violations or reviews blocked</small>
          </div>
        </div>
        <div className="metric">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sentinel-line bg-sentinel-canvas/70 text-sentinel-lime shadow-sm">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <span>Active Agent Fleet</span>
            <strong>{uniqueActiveAgents}</strong>
            <small>Emitting runtime telemetry</small>
          </div>
        </div>
      </section>

      {/* Filter & Search Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sentinel-line bg-sentinel-surface p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {["all", "allowed", "blocked", "approved", "executing"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                statusFilter === status
                  ? "border border-sentinel-lime/40 bg-sentinel-lime/10 text-sentinel-lime shadow-sm"
                  : "text-sentinel-muted hover:text-sentinel-text hover:bg-sentinel-surface-raised"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Agent Selector */}
          <select
            value={agentFilter}
            onChange={(e) => {
              setAgentFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by agent"
            className="h-8 rounded-lg border border-sentinel-line bg-sentinel-canvas/80 px-2.5 text-xs text-sentinel-text focus:border-sentinel-lime focus:outline-none"
          >
            <option value="all">All Agents ({availableAgents.length})</option>
            {availableAgents.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-sentinel-muted" />
            <input
              type="text"
              placeholder="Search actions, tools, trace IDs…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 w-56 rounded-lg border border-sentinel-line bg-sentinel-canvas/80 pl-8 pr-3 text-xs text-sentinel-text placeholder:text-sentinel-muted focus:border-sentinel-lime focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Main Telemetry Stream Table */}
      <section className="panel overflow-hidden">
        {filteredEvents.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No activity events found"
            description="No agent executions matched your current filter criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-sentinel-line bg-sentinel-surface/80 text-[11px] font-semibold text-sentinel-muted uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Agent</th>
                  <th className="py-3 px-4">Tool / Action</th>
                  <th className="py-3 px-4">Execution Context</th>
                  <th className="py-3 px-4 text-right">Inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sentinel-line/40">
                {paginatedEvents.map((event) => {
                  const isBlocked = event.result === "Blocked" || event.result === "Failed";
                  const isApproved =
                    event.result === "Approved" ||
                    event.result === "Allowed" ||
                    event.result === "Succeeded";
                  const isExecuting = event.result === "Executing";

                  return (
                    <tr
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className="cursor-pointer transition-colors hover:bg-sentinel-surface/60"
                    >
                      {/* Result Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border ${
                            isBlocked
                              ? "border-red-500/30 bg-red-500/10 text-red-500 dark:text-red-400"
                              : isApproved
                              ? "border-sentinel-lime/30 bg-sentinel-lime/10 text-sentinel-lime"
                              : isExecuting
                              ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-400 animate-pulse"
                              : "border-sentinel-line bg-sentinel-soft/20 text-sentinel-muted"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isBlocked
                                ? "bg-red-500"
                                : isApproved
                                ? "bg-sentinel-lime"
                                : isExecuting
                                ? "bg-cyan-400"
                                : "bg-sentinel-muted"
                            }`}
                          />
                          {event.result}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-sentinel-muted text-[11px]">
                        {displayTime(event.time)}
                      </td>

                      {/* Agent */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-sentinel-line bg-sentinel-canvas/80 text-sentinel-lime">
                            <Bot className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-semibold text-sentinel-text">{event.agent}</span>
                        </div>
                      </td>

                      {/* Tool / Action */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <code className="rounded border border-sentinel-line/80 bg-sentinel-canvas/90 px-2 py-0.5 font-mono text-[11px] text-sentinel-text">
                          {event.action}
                        </code>
                      </td>

                      {/* Detail */}
                      <td className="py-3 px-4 max-w-md truncate text-sentinel-muted">
                        {event.detail}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(event);
                          }}
                          className="rounded-lg border border-sentinel-line bg-sentinel-canvas/80 px-2.5 py-1 text-xs font-medium text-sentinel-muted transition-colors hover:border-sentinel-lime/40 hover:text-sentinel-text"
                        >
                          Inspect trace
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {filteredEvents.length > pageSize && (
          <div className="p-3 border-t border-sentinel-line">
            <TablePagination
              currentPage={currentPage}
              totalItems={filteredEvents.length}
              pageSize={pageSize}
              pageSizeOptions={[15, 30, 50]}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="telemetry events"
            />
          </div>
        )}
      </section>

      {/* Trace Inspector Slide-Over / Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm">
          <div className="h-full w-full max-w-xl border-l border-sentinel-line bg-sentinel-surface p-6 shadow-2xl overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-sentinel-line pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sentinel-lime/10 text-sentinel-lime border border-sentinel-lime/20">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-sentinel-text">AIOps Trace Inspector</h3>
                  <p className="text-xs text-sentinel-muted">Execution snapshot & policy enforcement record</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg p-1.5 text-sentinel-muted hover:bg-sentinel-surface-raised hover:text-sentinel-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Details */}
            <div className="mt-5 space-y-4 text-xs">
              {/* Event Identifiers */}
              <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sentinel-muted">Telemetry Event ID</span>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-sentinel-text">
                    <span>{selectedEvent.id}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedEvent.id, "id")}
                      className="text-sentinel-muted hover:text-sentinel-text"
                    >
                      {copiedId ? <Check className="h-3 w-3 text-sentinel-lime" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
                {selectedEvent.requestId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sentinel-muted">Request Correlation ID</span>
                    <span className="font-mono text-[11px] text-sentinel-text">{selectedEvent.requestId}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sentinel-muted">Observed Timestamp</span>
                  <span className="font-mono text-[11px] text-sentinel-text">{displayTime(selectedEvent.time)} ({selectedEvent.time})</span>
                </div>
              </div>

              {/* Execution Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas/60 p-3">
                  <p className="text-[11px] text-sentinel-muted">Autonomous Agent</p>
                  <p className="mt-1 font-semibold text-sentinel-text">{selectedEvent.agent}</p>
                </div>
                <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas/60 p-3">
                  <p className="text-[11px] text-sentinel-muted">Enforcement Result</p>
                  <p className="mt-1 font-semibold text-sentinel-text">{selectedEvent.result}</p>
                </div>
              </div>

              {/* Invocation / Operation */}
              <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas/60 p-3.5 space-y-1.5">
                <p className="font-semibold text-sentinel-text">Invoked Tool / Operation</p>
                <code className="block rounded border border-sentinel-line/80 bg-sentinel-surface p-2 font-mono text-[11px] text-sentinel-lime">
                  {selectedEvent.action}
                </code>
              </div>

              {/* Payload & Details */}
              <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas/60 p-3.5 space-y-1.5">
                <p className="font-semibold text-sentinel-text">Payload & Execution Context</p>
                <div className="rounded border border-sentinel-line/80 bg-sentinel-surface p-2.5 font-mono text-[11px] text-sentinel-text leading-relaxed whitespace-pre-wrap break-all">
                  {selectedEvent.detail}
                </div>
              </div>

              {/* Actor & External Reference */}
              <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas/60 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sentinel-muted">Executing Actor</span>
                  <span className="font-medium text-sentinel-text">{selectedEvent.actor}</span>
                </div>
                {selectedEvent.externalReference && (
                  <div className="flex items-center justify-between">
                    <span className="text-sentinel-muted">External System Ref</span>
                    <span className="font-mono text-sentinel-text">{selectedEvent.externalReference}</span>
                  </div>
                )}
              </div>

              {/* Raw JSON Trace */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sentinel-text">Raw Telemetry JSON</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(JSON.stringify(selectedEvent, null, 2), "json")}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-sentinel-lime hover:underline"
                  >
                    {copiedJson ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedJson ? "Copied" : "Copy JSON"}</span>
                  </button>
                </div>
                <pre className="max-h-52 overflow-auto rounded-xl border border-sentinel-line bg-sentinel-canvas p-3 font-mono text-[10px] text-sentinel-muted leading-relaxed">
                  {JSON.stringify(selectedEvent, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
