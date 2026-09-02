"use client";

import { Bot, ShieldAlert } from "lucide-react";
import type { Agent, AgentStatus, RiskLevel } from "@/lib/types";

export function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function statusLabel(status: AgentStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function executionLabel(status: Agent["lastExecutionStatus"]) {
  if (!status || status === "not_started") return null;
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function parseEventTimestamp(value: string, referenceTime = Date.now()): number {
  if (!value) return NaN;
  const direct = Date.parse(value);
  if (!Number.isNaN(direct)) {
    return direct;
  }
  if (/^\d{10,13}$/.test(value)) {
    const num = Number(value);
    return value.length === 10 ? num * 1000 : num;
  }
  const timeMatch = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    const meridiem = timeMatch[4]?.toUpperCase();

    if (meridiem === "PM" && hours < 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours = 0;

    const d = new Date(referenceTime);
    d.setHours(hours, minutes, seconds, 0);
    return d.getTime();
  }
  return NaN;
}

export function displayTime(value: string) {
  const timestamp = parseEventTimestamp(value);
  if (Number.isNaN(timestamp)) return value;
  const date = new Date(timestamp);
  const isToday = new Date().toDateString() === date.toDateString();
  if (isToday) {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Status({ status }: { status: AgentStatus }) {
  if (status === "quarantined") {
    return (
      <span className="status status-blocked border-sentinel-red/40 bg-sentinel-red/15 text-red-600 dark:text-red-300 font-semibold inline-flex items-center gap-1">
        <ShieldAlert className="h-3 w-3 text-red-500 shrink-0" />
        Quarantined
      </span>
    );
  }
  return (
    <span className={`status status-${status}`}>
      <span className="status-dot" />
      {statusLabel(status)}
    </span>
  );
}

export function Risk({ risk }: { risk: RiskLevel }) {
  return (
    <span className={`risk risk-${risk}`}>
      <span className="risk-dot" />
      {risk} risk
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Bot;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <Icon aria-hidden="true" />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
