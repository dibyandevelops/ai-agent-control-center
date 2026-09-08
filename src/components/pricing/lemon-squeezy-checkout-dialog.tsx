"use client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  Globe,
  LoaderCircle,
  Lock,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";

interface LemonSqueezyCheckoutDialogProps {
  open: boolean;
  planCode: PlanCode;
  billingInterval: "month" | "year";
  onClose: () => void;
  onSuccess?: (planName: string) => void;
}

export function LemonSqueezyCheckoutDialog({
  open,
  planCode,
  billingInterval: initialInterval,
  onClose,
  onSuccess,
}: LemonSqueezyCheckoutDialogProps) {
  const [interval, setInterval] = useState<"month" | "year">(initialInterval);
  const [loading, setLoading] = useState(false);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);

  if (!open) return null;

  const plan = planCatalog[planCode];
  const unitPrice = interval === "year" ? plan.priceAnnual : plan.priceMonthly;
  const billedAmount = interval === "year" ? unitPrice * 12 : unitPrice;

  async function handleProceedToCheckout() {
    setLoading(true);
    setError("");
    setRequiresAuth(false);

    try {
      const res = await fetch("/api/v1/billing/lemonsqueezy/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode,
          billingInterval: interval,
          simulateInstantActivation: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          setRequiresAuth(true);
          setError("Administrator account required before subscribing.");
          return;
        }
        throw new Error(data.error || "Failed to initialize Lemon Squeezy checkout.");
      }

      const payload = await res.json();

      // If live Lemon Squeezy URL, redirect to hosted checkout
      if (payload.isLive && payload.url) {
        window.location.href = payload.url;
        return;
      }

      // In dev/sandbox mode, instant local activation
      await new Promise((r) => setTimeout(r, 600));
      setCompleted(true);
      onSuccess?.(plan.name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Checkout failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[150] grid place-items-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-200"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-sentinel-line bg-sentinel-surface p-6 sm:p-7 shadow-2xl animate-dialog-in space-y-6"
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-sentinel-line">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-sentinel-lime/10 border border-sentinel-lime/20 flex items-center justify-center text-sentinel-lime">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-sentinel-text">Activate {plan.name}</h3>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-sentinel-lime border border-emerald-500/30 px-2 py-0.5 text-[10px] font-extrabold uppercase">
                  Lemon Squeezy
                </span>
              </div>
              <p className="text-xs text-sentinel-muted mt-0.5">
                Merchant of Record · Global GST & International Sales Tax Included
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-sentinel-muted hover:text-sentinel-text hover:bg-sentinel-surface-raised transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {completed ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-sentinel-lime border border-emerald-500/30">
              <Check className="h-7 w-7 stroke-[2.5]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-lg font-bold text-sentinel-text">Subscription Activated!</h4>
              <p className="text-xs text-sentinel-muted max-w-sm mx-auto leading-relaxed">
                Your workspace has been upgraded to <strong>{plan.name}</strong>. Quotas ({plan.agents ?? "Unlimited"} agents) and cryptographic audit retention ({plan.auditRetentionDays} days) are now live.
              </p>
            </div>
            <div className="pt-3">
              <button
                onClick={() => {
                  onClose();
                  window.location.reload();
                }}
                className="primary-button text-xs py-2.5 px-6 mx-auto"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Interval Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-sentinel-surface-raised border border-sentinel-line">
              <span className="text-xs font-semibold text-sentinel-text">Billing Cadence</span>
              <div className="inline-flex rounded-xl border border-sentinel-line bg-sentinel-surface p-1">
                <button
                  type="button"
                  onClick={() => setInterval("month")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    interval === "month"
                      ? "bg-sentinel-surface-raised text-sentinel-text shadow-xs"
                      : "text-sentinel-muted hover:text-sentinel-text"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setInterval("year")}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                    interval === "year"
                      ? "bg-emerald-600 dark:bg-sentinel-lime text-white dark:text-sentinel-canvas shadow-xs"
                      : "text-sentinel-muted hover:text-sentinel-text"
                  }`}
                >
                  <span>Annual</span>
                  <span className="text-[10px] rounded-full bg-white/20 dark:bg-black/20 px-1.5 py-0.2">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {/* Price Summary */}
            <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface-raised p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-sentinel-muted">Subscription Tier</span>
                <span className="text-sm font-bold text-sentinel-text">{plan.name}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-sentinel-muted">Effective Rate</span>
                <span className="text-sm font-black text-sentinel-text">
                  ${unitPrice}/mo
                </span>
              </div>
              <div className="pt-2 border-t border-sentinel-line flex items-baseline justify-between">
                <span className="text-xs font-bold text-sentinel-text">
                  Total Billed {interval === "year" ? "Today (12 Months)" : "Monthly"}
                </span>
                <span className="text-xl font-black text-emerald-600 dark:text-sentinel-lime">
                  ${billedAmount} USD
                </span>
              </div>
            </div>

            {/* Features list */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-sentinel-muted">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{plan.agents ? `${plan.agents} Autonomous Agents` : "Unlimited Agents"}</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>{plan.auditRetentionDays}-Day Cryptographic Audit</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Zero-Trust 4-Eyes Quorum</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Instant Quarantine Killswitch</span>
              </li>
            </ul>

            {error && (
              <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 flex items-start gap-2 text-xs text-red-500">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {requiresAuth ? (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 dark:border-sentinel-lime/40 dark:bg-sentinel-lime/10 p-4 space-y-2.5 text-center">
                <Sparkles className="h-5 w-5 text-emerald-600 dark:text-sentinel-lime mx-auto" />
                <div>
                  <h4 className="text-xs font-bold text-sentinel-text">Administrator Account Required</h4>
                  <p className="text-[11px] text-sentinel-muted mt-0.5">
                    To activate {plan.name}, create your organization and secure your admin credentials first.
                  </p>
                </div>
                <Link
                  href={`/get-started?plan=${planCode}&interval=${interval}`}
                  onClick={onClose}
                  className="primary-button w-full justify-center text-xs py-2.5 flex items-center gap-1.5"
                >
                  Continue to Workspace Setup <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleProceedToCheckout}
                disabled={loading}
                className="primary-button w-full justify-center text-sm py-3.5 font-bold shadow-lg shadow-emerald-500/20 dark:shadow-sentinel-lime/20 flex items-center gap-2"
              >
                {loading ? (
                  <LoaderCircle className="animate-spin h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {loading
                  ? "Connecting to Lemon Squeezy…"
                  : `Complete Checkout • $${billedAmount}`}
              </button>
            )}

            {/* Trust and Compliance Footer */}
            <div className="flex flex-wrap items-center justify-between text-[10px] text-sentinel-muted pt-1 border-t border-sentinel-line">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3 w-3 text-emerald-500" />
                <span>Global Cards, Apple Pay, PayPal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-emerald-500" />
                <span>MoR Protected · Bank-grade 256-bit SSL</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
