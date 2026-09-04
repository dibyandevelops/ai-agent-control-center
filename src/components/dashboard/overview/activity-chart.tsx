"use client";

import React from "react";
import type { AuditEvent } from "@/lib/types";
import {
  type ActivityPoint,
  type ActivityTimeRange,
} from "@/lib/dashboard-metrics";
import {
  useActivityTelemetry,
  chartMaximum,
} from "@/hooks/use-activity-telemetry";

export { chartMaximum };

export function ActivityChart({
  events,
  live,
  fallbackData,
}: {
  events: AuditEvent[];
  live: boolean;
  fallbackData: ActivityPoint[];
}) {
  const {
    timeRange,
    setTimeRange,
    data,
    ticks,
    width,
    height,
    padding,
    x,
    y,
    points,
    areaPoints,
  } = useActivityTelemetry(events, live, fallbackData);

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
