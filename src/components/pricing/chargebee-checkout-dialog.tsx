"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  CreditCard,
  LoaderCircle,
  Lock,
  ShieldCheck,
  Tag,
  X,
  Zap,
} from "lucide-react";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";
import { SentinelLogo } from "@/components/brand-logo";

interface ChargebeeCheckoutDialogProps {
  open: boolean;
  onClose: () => void;
  initialPlan?: PlanCode;
  initialInterval?: "month" | "year";
  onSuccess?: (plan: PlanCode) => void;
}

export function ChargebeeCheckoutDialog({
  open,
  onClose,
  initialPlan = "pro",
  initialInterval = "year",
  onSuccess,
}: ChargebeeCheckoutDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<PlanCode>(initialPlan);
  const [interval, setInterval] = useState<"month" | "year">(initialInterval);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "wire">("card");
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form Fields
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [cardExp, setCardExp] = useState("12/28");
  const [cardCvc, setCardCvc] = useState("888");
  const [companyName, setCompanyName] = useState("");
  const [vatNumber, setVatNumber] = useState("");

  if (!open) return null;

  const plan = planCatalog[selectedPlan];
  const basePrice = interval === "year" ? plan.priceAnnual : plan.priceMonthly;
  const discountMultiplier = appliedCoupon ? 0.8 : 1.0;
  const finalPrice = Math.round(basePrice * discountMultiplier);
  const annualTotal = finalPrice * 12;

  function applyDiscount() {
    if (!coupon.trim()) return;
    if (coupon.toUpperCase() === "SENTINEL20" || coupon.toUpperCase() === "LAUNCH") {
      setAppliedCoupon(coupon.toUpperCase());
      setError(null);
    } else {
      setError("Invalid discount code. Try 'SENTINEL20'");
    }
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/billing/chargebee/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planCode: selectedPlan,
          billingInterval: interval,
          coupon: appliedCoupon ?? undefined,
          simulateInstantActivation: true,
        }),
      });

      const data = (await res.json()) as { error?: string; success?: boolean };
      if (!res.ok) {
        throw new Error(data.error || "Chargebee checkout initialization failed.");
      }

      setSuccess(true);
      onSuccess?.(selectedPlan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout transaction failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl rounded-3xl border border-sentinel-line bg-sentinel-surface text-sentinel-text shadow-2xl overflow-hidden font-sentinel"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-sentinel-line px-6 py-4 bg-sentinel-surface-raised/50">
          <div className="flex items-center gap-2.5">
            <SentinelLogo size={24} />
            <div>
              <h2 className="text-sm font-bold text-sentinel-text">
                Chargebee Enterprise Checkout
              </h2>
              <p className="text-[10px] text-sentinel-muted font-mono">
                256-Bit Encrypted · PCI-DSS Level 1 Compliant Gateway
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-sentinel-muted hover:bg-sentinel-line/40 hover:text-sentinel-text transition"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-bold text-sentinel-text">
              {plan.name} Plan Activated!
            </h3>
            <p className="text-sm text-sentinel-muted max-w-md mx-auto">
              Your subscription is active via Chargebee. New agent limits ({plan.agents ?? "Unlimited"} agents) and extended cryptographic audit retention ({plan.auditRetentionDays} days) have been applied to your organization.
            </p>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  window.location.href = "/dashboard";
                }}
                className="primary-button inline-flex justify-center px-8 py-3 text-sm font-bold"
              >
                Go to Control Center <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCheckout} className="p-6 space-y-6">
            {/* Plan & Cycle Selector */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-sentinel-muted">
                  Select Plan
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPlan("pro")}
                    className={`rounded-xl border p-3 text-left transition ${
                      selectedPlan === "pro"
                        ? "border-emerald-500 bg-emerald-500/10 text-sentinel-text shadow-sm"
                        : "border-sentinel-line bg-sentinel-canvas text-sentinel-muted hover:text-sentinel-text"
                    }`}
                  >
                    <div className="text-xs font-bold">Team Pro</div>
                    <div className="text-base font-black mt-0.5">$79<span className="text-[10px] font-normal text-sentinel-muted">/mo</span></div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPlan("enterprise")}
                    className={`rounded-xl border p-3 text-left transition ${
                      selectedPlan === "enterprise"
                        ? "border-emerald-500 bg-emerald-500/10 text-sentinel-text shadow-sm"
                        : "border-sentinel-line bg-sentinel-canvas text-sentinel-muted hover:text-sentinel-text"
                    }`}
                  >
                    <div className="text-xs font-bold">Enterprise</div>
                    <div className="text-base font-black mt-0.5">$299<span className="text-[10px] font-normal text-sentinel-muted">/mo</span></div>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-sentinel-muted">
                  Billing Cycle
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInterval("month")}
                    className={`rounded-xl border p-3 text-left transition ${
                      interval === "month"
                        ? "border-emerald-500 bg-emerald-500/10 text-sentinel-text shadow-sm"
                        : "border-sentinel-line bg-sentinel-canvas text-sentinel-muted hover:text-sentinel-text"
                    }`}
                  >
                    <div className="text-xs font-bold">Monthly</div>
                    <div className="text-[11px] text-sentinel-muted mt-0.5">Flexible pay-as-you-go</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterval("year")}
                    className={`rounded-xl border p-3 text-left transition ${
                      interval === "year"
                        ? "border-emerald-500 bg-emerald-500/10 text-sentinel-text shadow-sm"
                        : "border-sentinel-line bg-sentinel-canvas text-sentinel-muted hover:text-sentinel-text"
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>Annual</span>
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-600 dark:text-sentinel-lime px-1.5 py-0.2 rounded font-mono">SAVE 20%</span>
                    </div>
                    <div className="text-[11px] text-sentinel-muted mt-0.5">Billed annually</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Payment Method Switcher */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-sentinel-muted">
                  Payment Method
                </label>
                <span className="text-[10px] text-sentinel-muted font-mono flex items-center gap-1">
                  <Lock className="h-3 w-3 text-emerald-500" /> Powered by Chargebee
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                    paymentMethod === "card"
                      ? "border-emerald-500 bg-emerald-500/10 text-sentinel-text"
                      : "border-sentinel-line bg-sentinel-canvas text-sentinel-muted"
                  }`}
                >
                  <CreditCard className="h-4 w-4 text-emerald-600 dark:text-sentinel-lime" /> Credit / Debit Card
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("wire")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition ${
                    paymentMethod === "wire"
                      ? "border-emerald-500 bg-emerald-500/10 text-sentinel-text"
                      : "border-sentinel-line bg-sentinel-canvas text-sentinel-muted"
                  }`}
                >
                  <Building2 className="h-4 w-4 text-amber-500" /> Wire / Net-30 Invoicing
                </button>
              </div>

              {paymentMethod === "card" ? (
                <div className="rounded-2xl border border-sentinel-line bg-sentinel-canvas p-4 space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-sentinel-muted">Card Number</label>
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-surface px-3 font-mono text-xs text-sentinel-text outline-none focus:border-emerald-500"
                      placeholder="4242 •••• •••• 4242"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-sentinel-muted">Expires</label>
                      <input
                        type="text"
                        value={cardExp}
                        onChange={(e) => setCardExp(e.target.value)}
                        className="mt-1 h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-surface px-3 font-mono text-xs text-sentinel-text outline-none focus:border-emerald-500"
                        placeholder="MM/YY"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-sentinel-muted">CVC / CVV</label>
                      <input
                        type="text"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        className="mt-1 h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-surface px-3 font-mono text-xs text-sentinel-text outline-none focus:border-emerald-500"
                        placeholder="888"
                        required
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-sentinel-line bg-sentinel-canvas p-4 space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-sentinel-muted">Legal Entity / Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-surface px-3 text-xs text-sentinel-text outline-none focus:border-emerald-500"
                      placeholder="AtlasPay International Inc."
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-sentinel-muted">Tax ID / VAT Registration (Optional)</label>
                    <input
                      type="text"
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-surface px-3 font-mono text-xs text-sentinel-text outline-none focus:border-emerald-500"
                      placeholder="US-EIN / EU-VAT"
                    />
                  </div>
                  <p className="text-[11px] text-sentinel-muted leading-normal">
                    An official Chargebee tax invoice with Net-30 ACH routing details will be emailed to your organization administrator.
                  </p>
                </div>
              )}
            </div>

            {/* Coupon Code Strip */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-2.5 h-4 w-4 text-sentinel-muted" />
                <input
                  type="text"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Promo code (e.g. SENTINEL20)"
                  className="h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas pl-9 pr-3 text-xs text-sentinel-text uppercase font-mono outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="button"
                onClick={applyDiscount}
                className="secondary-button text-xs px-4 py-2"
              >
                Apply
              </button>
            </div>

            {appliedCoupon && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-sentinel-lime flex items-center justify-between">
                <span>Code &quot;{appliedCoupon}&quot; Applied: 20% Lifetime Discount</span>
                <Check className="h-4 w-4" />
              </div>
            )}

            {/* Total Summary */}
            <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface-raised/60 p-4 space-y-2 font-mono text-xs">
              <div className="flex justify-between text-sentinel-muted">
                <span>Subscription Plan</span>
                <span className="text-sentinel-text font-bold">{plan.name} ({interval === "year" ? "Annual" : "Monthly"})</span>
              </div>
              {interval === "year" && (
                <div className="flex justify-between text-sentinel-muted">
                  <span>Annual Commitment</span>
                  <span className="text-sentinel-text font-bold">${annualTotal} / year</span>
                </div>
              )}
              <div className="flex justify-between text-sentinel-text text-sm font-bold border-t border-sentinel-line pt-2">
                <span>Due Today</span>
                <span className="text-emerald-600 dark:text-sentinel-lime">
                  ${interval === "year" ? annualTotal : finalPrice}
                </span>
              </div>
            </div>

            {error && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            {/* Checkout CTA */}
            <button
              type="submit"
              disabled={loading}
              className="primary-button w-full justify-center py-3.5 text-sm font-bold shadow-md shadow-emerald-500/20 dark:shadow-sentinel-lime/20"
            >
              {loading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {loading ? "Processing via Chargebee…" : `Complete Chargebee Checkout • $${interval === "year" ? annualTotal : finalPrice}`}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
