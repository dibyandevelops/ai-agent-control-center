"use client";

import React, { useState } from "react";
import {
  Award,
  Check,
  Copy,
  Download,
  Lock,
  ShieldCheck,
  X,
} from "lucide-react";
import type { ComplianceExportPackage } from "@/lib/server/compliance-export";

interface ComplianceCertificateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  data: ComplianceExportPackage | null;
  loading: boolean;
  onDownload: () => void;
}

export function ComplianceCertificateDialog({
  isOpen,
  onClose,
  data,
  loading,
  onDownload,
}: ComplianceCertificateDialogProps) {
  const [copiedDigest, setCopiedDigest] = useState(false);

  if (!isOpen) return null;

  const certificate = data?.certificate;

  const copyDigest = async () => {
    if (!certificate?.attestationDigest) return;
    await navigator.clipboard.writeText(certificate.attestationDigest);
    setCopiedDigest(true);
    setTimeout(() => setCopiedDigest(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl rounded-2xl border border-sentinel-line bg-sentinel-surface p-6 sm:p-7 shadow-2xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl p-2 text-sentinel-muted hover:bg-sentinel-canvas hover:text-sentinel-text transition"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 pb-4 border-b border-sentinel-line">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-sentinel-lime border border-emerald-500/20">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-sentinel-text">
              SOC 2 & ISO 27001 Compliance Certificate
            </h2>
            <p className="text-xs text-sentinel-muted">
              Cryptographically signed attestation and tamper-evident hash evidence
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center space-y-3">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent dark:border-sentinel-lime" />
            <p className="text-xs font-semibold text-sentinel-muted">
              Evaluating SHA-256 chain integrity & generating attestation…
            </p>
          </div>
        ) : certificate ? (
          <div className="mt-5 space-y-5">
            {/* Status Card */}
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-sentinel-lime" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-800 dark:text-sentinel-lime">
                    Hash Chain Intact & Verified
                  </h4>
                  <p className="text-xs text-emerald-700/80 dark:text-sentinel-lime/80">
                    {certificate.chainIntegrity.eventsEvaluated} audit events verified with zero tamper anomalies
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-emerald-600/20 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-sentinel-lime uppercase tracking-wider">
                Audited
              </span>
            </div>

            {/* Certificate Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas p-3">
                <span className="font-bold text-sentinel-muted uppercase tracking-wider text-[10px]">
                  Subject Organization
                </span>
                <p className="mt-1 font-semibold text-sentinel-text">
                  {certificate.organization.name}
                </p>
                <p className="text-[11px] text-sentinel-muted">
                  Slug: {certificate.organization.slug}
                </p>
              </div>

              <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas p-3">
                <span className="font-bold text-sentinel-muted uppercase tracking-wider text-[10px]">
                  Compliance Standard
                </span>
                <p className="mt-1 font-semibold text-sentinel-text">
                  SOC 2 Type II / ISO 27001 Annex A.12
                </p>
                <p className="text-[11px] text-sentinel-muted">NIST SP 800-53 AU-9</p>
              </div>

              <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas p-3">
                <span className="font-bold text-sentinel-muted uppercase tracking-wider text-[10px]">
                  Certificate Identifier
                </span>
                <p className="mt-1 font-mono text-[11px] text-sentinel-text truncate">
                  {certificate.certificateId}
                </p>
                <p className="text-[11px] text-sentinel-muted">
                  Issued: {new Date(certificate.issuedAt).toLocaleString()}
                </p>
              </div>

              <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas p-3">
                <span className="font-bold text-sentinel-muted uppercase tracking-wider text-[10px]">
                  Verified Operator Identity
                </span>
                <p className="mt-1 font-semibold text-sentinel-text truncate">
                  {certificate.operator.email}
                </p>
                <p className="text-[11px] text-sentinel-muted uppercase tracking-wider">
                  Role: {certificate.operator.role}
                </p>
              </div>
            </div>

            {/* Cryptographic Attestation Digest */}
            <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas p-3.5">
              <div className="flex items-center justify-between pb-1.5">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sentinel-muted">
                  <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-sentinel-lime" />
                  SHA-256 Attestation Digest
                </span>
                <button
                  onClick={copyDigest}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-sentinel-lime hover:underline"
                >
                  {copiedDigest ? (
                    <>
                      <Check className="h-3 w-3" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy Digest
                    </>
                  )}
                </button>
              </div>
              <p className="font-mono text-xs break-all text-sentinel-text bg-sentinel-surface p-2.5 rounded-lg border border-sentinel-line/60 select-all">
                {certificate.attestationDigest}
              </p>
            </div>

            {/* Scope Summary Stats */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas p-3">
                <span className="text-lg font-bold text-sentinel-text">
                  {data?.auditTrail.length ?? 0}
                </span>
                <p className="text-[10px] text-sentinel-muted font-bold uppercase tracking-wider">
                  Audit Events
                </p>
              </div>
              <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas p-3">
                <span className="text-lg font-bold text-sentinel-text">
                  {data?.governanceRecords.length ?? 0}
                </span>
                <p className="text-[10px] text-sentinel-muted font-bold uppercase tracking-wider">
                  4-Eyes Records
                </p>
              </div>
              <div className="rounded-xl border border-sentinel-line bg-sentinel-canvas p-3">
                <span className="text-lg font-bold text-sentinel-text">
                  {data?.approverDelegations.length ?? 0}
                </span>
                <p className="text-[10px] text-sentinel-muted font-bold uppercase tracking-wider">
                  Delegations
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-3 border-t border-sentinel-line">
              <button
                onClick={onClose}
                className="secondary-button justify-center text-xs"
              >
                Close
              </button>
              <button
                onClick={onDownload}
                className="primary-button justify-center text-xs font-bold"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Signed Evidence (.json)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-red-500">
            Failed to load compliance certificate. Please ensure your account has Auditor or Admin privileges.
          </div>
        )}
      </div>
    </div>
  );
}
