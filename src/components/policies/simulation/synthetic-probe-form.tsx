"use client";

import { Play, Sparkles } from "lucide-react";
import React from "react";

export function SyntheticProbeForm({
  synthAction,
  setSynthAction,
  synthResource,
  setSynthResource,
  synthEnv,
  setSynthEnv,
  synthRisk,
  setSynthRisk,
  synthRecordCount,
  setSynthRecordCount,
  onRun,
  loading,
}: {
  synthAction: string;
  setSynthAction: (val: string) => void;
  synthResource: string;
  setSynthResource: (val: string) => void;
  synthEnv: "production" | "staging" | "development";
  setSynthEnv: (val: "production" | "staging" | "development") => void;
  synthRisk: "low" | "medium" | "high";
  setSynthRisk: (val: "low" | "medium" | "high") => void;
  synthRecordCount: string;
  setSynthRecordCount: (val: string) => void;
  onRun: () => void;
  loading: boolean;
}) {
  return (
    <div className="border-t border-sentinel-line/60 bg-sentinel-canvas/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-sentinel-text">
          <Sparkles className="h-3.5 w-3.5 text-sentinel-lime" /> Ad-Hoc Synthetic Probe Builder
        </span>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-sentinel-line px-2 text-[11px] font-medium text-sentinel-muted hover:border-sentinel-lime/40 hover:text-sentinel-text"
          onClick={() => {
            setSynthAction("aws.iam.attach_admin_policy");
            setSynthResource("arn:aws:iam::123456789012:role/DeployRole");
            setSynthEnv("production");
            setSynthRisk("high");
            setSynthRecordCount("1");
          }}
        >
          Load IAM Escalate Preset
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="block text-[10px] uppercase font-semibold text-sentinel-dim">Action</label>
          <input
            className="mt-1 h-8 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-2.5 font-mono text-[11px] text-sentinel-text outline-none focus:border-sentinel-lime/50"
            value={synthAction}
            onChange={(e) => setSynthAction(e.target.value)}
            placeholder="e.g. database.delete_records"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-semibold text-sentinel-dim">Resource</label>
          <input
            className="mt-1 h-8 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-2.5 font-mono text-[11px] text-sentinel-text outline-none focus:border-sentinel-lime/50"
            value={synthResource}
            onChange={(e) => setSynthResource(e.target.value)}
            placeholder="e.g. production_users"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase font-semibold text-sentinel-dim">Environment</label>
          <select
            className="mt-1 h-8 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-2 text-[11px] text-sentinel-text outline-none"
            value={synthEnv}
            onChange={(e) => setSynthEnv(e.target.value as "production" | "staging" | "development")}
          >
            <option value="production">production</option>
            <option value="staging">staging</option>
            <option value="development">development</option>
          </select>
        </div>
        <div>
          <label className="block text-[10px] uppercase font-semibold text-sentinel-dim">Risk hint</label>
          <select
            className="mt-1 h-8 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-2 text-[11px] text-sentinel-text outline-none"
            value={synthRisk}
            onChange={(e) => setSynthRisk(e.target.value as "low" | "medium" | "high")}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[10px] uppercase font-semibold text-sentinel-dim">Context (recordCount)</label>
            <input
              type="number"
              className="mt-1 h-8 w-full rounded-lg border border-sentinel-line bg-sentinel-canvas px-2 text-[11px] text-sentinel-text outline-none"
              value={synthRecordCount}
              onChange={(e) => setSynthRecordCount(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-sentinel-lime/30 bg-sentinel-lime/15 px-3 text-[11px] font-semibold text-sentinel-lime transition hover:bg-sentinel-lime/25"
            onClick={onRun}
            disabled={loading}
          >
            <Play className="h-3 w-3" /> Test
          </button>
        </div>
      </div>
    </div>
  );
}
