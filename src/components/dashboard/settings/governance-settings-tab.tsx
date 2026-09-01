"use client";

import {
  Check,
  Download,
  FileCheck2,
  FileClock,
  Key,
  Lock,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";

export function GovernanceSettingsTab({
  integrityVerified,
  onVerifyIntegrity,
}: {
  integrityVerified: boolean;
  onVerifyIntegrity: () => Promise<void>;
}) {
  const [verifying, setVerifying] = useState(false);
  const [retentionDays, setRetentionDays] = useState<number>(365);

  async function handleVerify() {
    setVerifying(true);
    try {
      await onVerifyIntegrity();
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cryptographic Chain Status */}
      <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-sentinel-line">
          <div className="flex items-start gap-4">
            <div
              className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                integrityVerified
                  ? "border-sentinel-lime/30 bg-sentinel-lime/10 text-sentinel-lime"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-500"
              }`}
            >
              {integrityVerified ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-sentinel-text">
                SHA-256 Cryptographic Hash Chain
              </h3>
              <p className="mt-0.5 text-xs text-sentinel-muted">
                {integrityVerified
                  ? "All audit log events are cryptographically sealed and verified tamper-proof."
                  : "Cryptographic validation pending check."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="secondary-button flex items-center gap-1.5 self-start sm:self-auto shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${verifying ? "animate-spin" : ""}`} />
            {verifying ? "Verifying Seals…" : "Verify Chain Integrity"}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl border border-sentinel-line bg-sentinel-surface-raised/40">
            <span className="text-[11px] font-semibold text-sentinel-muted uppercase tracking-wider block">
              Chain Algorithm
            </span>
            <strong className="text-xs text-sentinel-text font-mono mt-1 block">HMAC-SHA-256</strong>
          </div>

          <div className="p-3.5 rounded-xl border border-sentinel-line bg-sentinel-surface-raised/40">
            <span className="text-[11px] font-semibold text-sentinel-muted uppercase tracking-wider block">
              Tamper Resistance
            </span>
            <strong className="text-xs text-sentinel-lime mt-1 flex items-center gap-1">
              <Check className="h-3 w-3" /> Hardware/DB Monotonic
            </strong>
          </div>

          <div className="p-3.5 rounded-xl border border-sentinel-line bg-sentinel-surface-raised/40">
            <span className="text-[11px] font-semibold text-sentinel-muted uppercase tracking-wider block">
              Compliance Standard
            </span>
            <strong className="text-xs text-sentinel-text mt-1 block">SOC-2 / ISO 27001 / HIPAA</strong>
          </div>
        </div>
      </div>

      {/* Audit Log Retention */}
      <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-6">
        <h4 className="text-sm font-semibold text-sentinel-text flex items-center gap-2">
          <FileClock className="h-4 w-4 text-sentinel-lime" />
          Audit Log Retention Window
        </h4>
        <p className="mt-1 text-xs text-sentinel-muted leading-relaxed">
          Determines how long immutable audit evidence and agent evaluation logs are retained before archival.
        </p>

        <div className="mt-4 max-w-sm">
          <select
            className="h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-surface-raised px-3 text-xs text-sentinel-text outline-none focus:border-sentinel-lime transition"
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
          >
            <option value={90}>90 Days (Standard Tier)</option>
            <option value={180}>180 Days (Scale Tier)</option>
            <option value={365}>1 Year / 365 Days (Pro Default)</option>
            <option value={2555}>7 Years (Enterprise Compliance)</option>
          </select>
        </div>
      </div>

      {/* Compliance Evidence Export */}
      <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-6">
        <h4 className="text-sm font-semibold text-sentinel-text flex items-center gap-2">
          <Download className="h-4 w-4 text-sentinel-lime" />
          Export Signed Audit Evidence
        </h4>
        <p className="mt-1 text-xs text-sentinel-muted leading-relaxed">
          Download a verified, digitally signed package of all agent evaluations, approvals, and outcomes for your compliance auditors.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href="/api/v1/audit/export?format=json"
            download
            className="secondary-button flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON Archive
          </a>
          <a
            href="/api/v1/audit/export?format=csv"
            download
            className="secondary-button flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV Records
          </a>
        </div>
      </div>
    </div>
  );
}
