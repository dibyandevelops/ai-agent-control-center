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

interface DodoPaymentsCheckoutDialogProps {
  open: boolean;
  planCode: PlanCode;
  billingInterval: "month" | "year";
  onClose: () => void;
  onSuccess?: (planName: string) => void;
}

export function DodoPaymentsCheckoutDialog({
  open,
  planCode,
  billingInterval: initialInterval,
  onClose,
  onSuccess,
}: DodoPaymentsCheckoutDialogProps) {
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
      const res = await fetch("/api/v1/billing/dodopayments/checkout", {
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
        throw new Error(data.error || "Failed to initialize Dodo Payments checkout.");
      }

      const payload = await res.json();

      // If live Dodo Payments checkout URL, redirect to hosted session
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
        aria-labelledby="dodo-checkout-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-sentinel-line/40 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-500/30 bg-teal-500/10 text-teal-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">
                  Merchant of Record
                </span>
                <span className="inline-flex items-center rounded-full bg-sentinel-line/60 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                  Global SaaS
                </span>
              </div>
              <h2 id="dodo-checkout-title" className="text-xl font-bold text-sentinel-text">
                Upgrade to {plan.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {completed ? (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30">
              <Check className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold text-white">Subscription Active!</h3>
            <p className="text-sm text-slate-400 max-w-xs mx-auto">
              Your organization has been upgraded to the <strong>{plan.name}</strong> plan.
            </p>
            <div className="pt-2">
              <Link
                href="/dashboard"
                onClick={onClose}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-500 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-teal-400 shadow-lg shadow-teal-500/20"
              >
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Billing Interval Toggle */}
            <div className="flex rounded-2xl border border-sentinel-line/60 bg-sentinel-card/60 p-1">
              <button
                type="button"
                onClick={() => setInterval("month")}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-all ${
                  interval === "month"
                    ? "bg-teal-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Monthly (${plan.priceMonthly}/mo)
              </button>
              <button
                type="button"
                onClick={() => setInterval("year")}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                  interval === "year"
                    ? "bg-teal-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Annual (${plan.priceAnnual}/mo)
                <span className="rounded bg-teal-950/40 px-1.5 py-0.5 text-[10px] text-teal-300 font-bold border border-teal-500/20">
                  Save 20%
                </span>
              </button>
            </div>

            {/* Price Summary */}
            <div className="rounded-2xl border border-sentinel-line/60 bg-sentinel-card/30 p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-xs text-slate-400">Total Billed Today</p>
                  <p className="text-2xl font-extrabold text-white">
                    ${billedAmount.toLocaleString()}
                    <span className="text-xs font-normal text-slate-400">
                      /{interval === "year" ? "year" : "month"}
                    </span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" /> 14-day money back
                  </span>
                  <p className="text-[11px] text-slate-400 mt-0.5">Cancel anytime in 1-click</p>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-400">Plan Highlights:</p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                  <span>{plan.auditRetentionDays} days audit retention</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                  <span>{plan.maxAgents} autonomous agent slots</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                  <span>{plan.slaGuarantee} uptime SLA</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                  <span>Real-time SIEM audit stream</span>
                </li>
              </ul>
            </div>

            {/* Merchant of Record & Tax Note */}
            <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 p-3 text-xs text-slate-400 flex items-start gap-2.5">
              <Globe className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Processed via <strong>Dodo Payments (Merchant of Record)</strong>. Handles Australian GST, US Sales Tax, EU VAT, and automatic corporate invoices.
              </p>
            </div>

            {/* Error Display */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{error}</p>
                  {requiresAuth && (
                    <div className="mt-2 flex gap-3">
                      <Link
                        href={`/get-started?plan=${planCode}&interval=${interval}`}
                        className="font-semibold text-white underline hover:text-teal-400"
                        onClick={onClose}
                      >
                        Create Operator Account →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Action CTA */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={handleProceedToCheckout}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-500 py-3.5 text-sm font-semibold text-slate-950 transition-all hover:bg-teal-400 disabled:opacity-50 shadow-lg shadow-teal-500/20 active:scale-[0.98]"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Connecting to Dodo Checkout...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 fill-current" />
                    Proceed to Secure Checkout
                  </>
                )}
              </button>
              <p className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
                <Lock className="h-3 w-3" /> 256-bit TLS encrypted • Powered by Dodo Payments
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
