"use client";

import React, { useMemo, useState } from "react";
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

export function ActivityChart({
  events,
  live,
  fallbackData,
}: {
  events: AuditEvent[];
  live: boolean;
  fallbackData: ActivityPoint[];
}) {
  const [timeRange, setTimeRange] = useState<ActivityTimeRange>("7d");
  const width = 760;
  const height = 210;
  const padding = { left: 38, right: 12, top: 12, bottom: 24 };

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

  return (
    <section className="panel chart-panel">
      <div className="section-heading">
        <div>
          <h2>Autonomous Actions & Interceptions</h2>
          <p>
            {timeRange === "24h"
              ? "Policy evaluations across the last 24 hours"
              : timeRange === "14d"
                ? "Policy evaluations across the last 14 days"
                : timeRange === "30d"
                  ? "Policy evaluations across the last 30 days"
                  : "Policy evaluations across the last 7 days"}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-sentinel-line bg-sentinel-canvas/70 p-0.5 text-xs">
          {(["24h", "7d", "14d", "30d"] as ActivityTimeRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all ${
                timeRange === range
                  ? "bg-sentinel-surface text-sentinel-lime shadow-sm"
                  : "text-sentinel-muted hover:text-sentinel-text"
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-legend" aria-hidden="true">
        <span><i className="legend-allowed" />Allowed</span>
        <span><i className="legend-approved" />Approved</span>
        <span><i className="legend-blocked" />Blocked</span>
      </div>

      <div className="chart-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Activity chart showing allowed, approved, and blocked agent actions"
        >
          <defs>
            <linearGradient id="gradient-area-allowed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="gradient-area-approved" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="gradient-area-blocked" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines */}
          {ticks.map((value) => (
            <g key={value}>
              <line
                x1={padding.left}
                x2={width - padding.right}
                y1={y(value)}
                y2={y(value)}
                className="chart-grid-line"
              />
              <text x={0} y={y(value) + 3} className="chart-axis-label">
                {Math.round(value).toLocaleString()}
              </text>
            </g>
          ))}

          {/* Area Fills */}
          <polygon points={areaPoints("allowed")} fill="url(#gradient-area-allowed)" />
          <polygon points={areaPoints("approved")} fill="url(#gradient-area-approved)" />
          <polygon points={areaPoints("blocked")} fill="url(#gradient-area-blocked)" />

          {/* Lines */}
          <polyline points={points("allowed")} className="chart-line chart-line-allowed" />
          <polyline points={points("approved")} className="chart-line chart-line-approved" />
          <polyline points={points("blocked")} className="chart-line chart-line-blocked" />

          {/* Data Points */}
          {(["allowed", "approved", "blocked"] as const).flatMap((key) =>
            data.map((item, index) => (
              <circle
                key={`${key}-${item.day}`}
                cx={x(index)}
                cy={y(item[key])}
                r={key === "allowed" ? 3.5 : 3}
                className={`chart-point chart-point-${key}`}
              />
            )),
          )}

          {/* Bottom Day Labels */}
          {data.map((item, index) => (
            <text
              key={item.day}
              x={x(index)}
              y={height - 3}
              textAnchor="middle"
              className="chart-axis-label chart-day-label"
            >
              {item.day}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}
