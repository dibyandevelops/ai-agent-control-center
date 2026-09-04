"use client";

import { useMemo, useState } from "react";
import type { AuditEvent } from "@/lib/types";
import {
  buildActivityChartData,
  type ActivityPoint,
  type ActivityTimeRange,
} from "@/lib/dashboard-metrics";

export function chartMaximum(data: ActivityPoint[]) {
  const rawMaximum = Math.max(
    1,
    ...data.flatMap((point) => [point.allowed, point.approved, point.blocked]),
  );
  if (rawMaximum <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawMaximum));
  const normalized = rawMaximum / magnitude;
  const rounded = normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return rounded * magnitude;
}

export interface UseActivityTelemetryOptions {
  width?: number;
  height?: number;
  padding?: { left: number; right: number; top: number; bottom: number };
  initialRange?: ActivityTimeRange;
}

export function useActivityTelemetry(
  events: AuditEvent[],
  live: boolean,
  fallbackData: ActivityPoint[],
  options?: UseActivityTelemetryOptions,
) {
  const [timeRange, setTimeRange] = useState<ActivityTimeRange>(
    options?.initialRange ?? "7d",
  );

  const width = options?.width ?? 760;
  const height = options?.height ?? 210;
  const padding = options?.padding ?? { left: 38, right: 12, top: 12, bottom: 24 };

  const data = useMemo(() => {
    if (live || events.length > 0) {
      return buildActivityChartData(events, timeRange);
    }
    return fallbackData;
  }, [events, live, fallbackData, timeRange]);

  const max = chartMaximum(data);
  const ticks = [0, max / 4, max / 2, (max * 3) / 4, max];

  const x = (index: number) =>
    padding.left +
    (index * (width - padding.left - padding.right)) / Math.max(1, data.length - 1);

  const y = (value: number) =>
    padding.top +
    (1 - value / max) * (height - padding.top - padding.bottom);

  const points = (key: "allowed" | "approved" | "blocked") =>
    data.map((item, index) => `${x(index)},${y(item[key])}`).join(" ");

  const areaPoints = (key: "allowed" | "approved" | "blocked") => {
    const bottomY = height - padding.bottom;
    const startX = padding.left;
    const endX = width - padding.right;
    const linePoints = data.map((item, index) => `${x(index)},${y(item[key])}`).join(" ");
    return `${startX},${bottomY} ${linePoints} ${endX},${bottomY}`;
  };

  return {
    timeRange,
    setTimeRange,
    data,
    max,
    ticks,
    width,
    height,
    padding,
    x,
    y,
    points,
    areaPoints,
  };
}
