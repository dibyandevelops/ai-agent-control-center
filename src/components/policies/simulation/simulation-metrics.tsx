"use client";

import React from "react";

export function SimulationMetrics({
  evaluated,
  matched,
  determining,
  changed,
}: {
  evaluated: number;
  matched: number;
  determining: number;
  changed: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-sentinel-line/60 bg-sentinel-canvas/30 p-3 sm:grid-cols-4">
      <div className="rounded-lg border border-sentinel-line bg-sentinel-surface p-2.5 text-center">
        <span className="block text-[10px] uppercase font-semibold text-sentinel-dim">Evaluated</span>
        <strong className="mt-0.5 block font-mono text-sm font-bold text-sentinel-text">
          {evaluated}
        </strong>
      </div>
      <div className="rounded-lg border border-sentinel-line bg-sentinel-surface p-2.5 text-center">
        <span className="block text-[10px] uppercase font-semibold text-sentinel-dim">Rule Matched</span>
        <strong className="mt-0.5 block font-mono text-sm font-bold text-sentinel-lime">
          {matched}
        </strong>
      </div>
      <div className="rounded-lg border border-sentinel-line bg-sentinel-surface p-2.5 text-center">
        <span className="block text-[10px] uppercase font-semibold text-sentinel-dim">Determining Winner</span>
        <strong className="mt-0.5 block font-mono text-sm font-bold text-sentinel-text">
          {determining}
        </strong>
      </div>
      <div className="rounded-lg border border-sentinel-line bg-sentinel-surface p-2.5 text-center">
        <span className="block text-[10px] uppercase font-semibold text-sentinel-dim">Decisions Changed</span>
        <strong
          className={`mt-0.5 block font-mono text-sm font-bold ${
            changed > 0 ? "text-sentinel-amber" : "text-sentinel-lime"
          }`}
        >
          {changed}
        </strong>
      </div>
    </div>
  );
}
