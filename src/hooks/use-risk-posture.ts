"use client";

import { useMemo } from "react";
import type { AuditEvent } from "@/lib/types";

export function calculateRiskPosture(events: AuditEvent[], maxItems = 4) {
  const blockedEvents = events.filter(
    (e) => e.result === "Blocked" || e.result === "Failed",
  );
  const approvedEvents = events.filter((e) => e.result === "Approved");

  const blockedCount = blockedEvents.length;
  const approvedCount = approvedEvents.length;
  const totalInterceptions = blockedCount + approvedCount;
  const blockRatio =
    totalInterceptions > 0 ? (blockedCount / totalInterceptions) * 100 : 0;

  const recentEvents = events.slice(0, maxItems);

  return {
    blockedCount,
    approvedCount,
    totalInterceptions,
    blockRatio,
    recentEvents,
    isHighRisk: blockedCount > 0,
  };
}

export function useRiskPosture(events: AuditEvent[], maxItems = 4) {
  return useMemo(
    () => calculateRiskPosture(events, maxItems),
    [events, maxItems],
  );
}
