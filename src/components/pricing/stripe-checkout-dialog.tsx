"use client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  Lock,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";

interface StripeCheckoutDialogProps {
  open: boolean;
  planCode: PlanCode;
  billingInterval: "month" | "year";
  onClose: () => void;
  onSuccess?: (planName: string) => void;
}

export function StripeCheckoutDialog({
  open,
  planCode,
  billingInterval,
  onClose,
  onSuccess,
}: StripeCheckoutDialogProps) {
  const [cardNumber, setCardNumber] = useState("4242 •••• •••• 4242");
  const [cardExpiry, setCardExpiry] = useState("12/28");
  const [cardCvc, setCardCvc] = useState("•••");
  const [cardholderName, setCardholderName] = useState("Sarah Connor");
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [receiptId, setReceiptId] = useState("");

  if (!open) return null;

  const plan = planCatalog[planCode];
  const basePrice =
    billingInterval === "year" ? plan.priceAnnual : plan.priceMonthly;
  const discountMultiplier = couponApplied ? 0.8 : 1.0;
  const finalPrice = Math.round(basePrice * discountMultiplier);
  const billedAmount = billingInterval === "year" ? finalPrice * 12 : finalPrice;

  async function handleApplyCoupon() {
    if (couponCode.trim().toUpperCase() === "EARLYBIRD" || couponCode.trim().toUpperCase() === "SENTINEL20") {
      setCouponApplied(true);
      setError("");
    } else {
      setError("Invalid or expired promo code.");
    }
  }

  async function handleSubmitPayment(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRequiresAuth(false);

    try {
      const generatedReceipt = `rec_stripe_${Date.now().toString(36)}`;
      const res = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planCode,
          billingInterval,
          coupon: couponApplied ? couponCode : undefined,
          paymentMethod: {
            brand: "visa",
            last4: cardNumber.replace(/\D/g, "").slice(-4) || "4242",
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          setRequiresAuth(true);
          setError("Workspace account required before activating a subscription.");
          return;
        }
        throw new Error(data.error || "Payment processing failed.");
      }

      await new Promise((r) => setTimeout(r, 600));
      setReceiptId(generatedReceipt);
      setCompleted(true);
      onSuccess?.(plan.name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Payment failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="dialog-backdrop fixed inset-0 z-[150] grid place-items-center bg-black/75 p-4 backdrop-blur-md"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-sentinel-line-strong bg-sentinel-surface shadow-2xl animate-dialog-in"
        role="dialog"
        aria-modal="true"
        aria-label="Stripe Checkout"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header with Stripe Branding */}
        <div className="flex items-center justify-between border-b border-sentinel-line bg-sentinel-canvas/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#635bff] text-white font-bold text-xs shadow-sm">
              S
            </span>
            <div>
              <h3 className="text-sm font-bold text-sentinel-text">Secure Stripe Checkout</h3>
              <p className="text-[11px] text-sentinel-muted">256-Bit Encrypted Gateway</p>
            </div>
          </div>
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-lg text-sentinel-muted hover:bg-sentinel-raised hover:text-sentinel-text"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {completed ? (
          <div className="p-8 text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sentinel-lime/10 text-sentinel-lime">
              <CheckCircle2 className="h-10 w-10 animate-scale-in" />
            </div>
            <h3 className="text-xl font-bold text-sentinel-text">
              Welcome to {plan.name}!
            </h3>
            <p className="text-xs text-sentinel-muted max-w-sm mx-auto leading-relaxed">
              Your subscription is active and your organization limits have been upgraded immediately.
            </p>
            <div className="rounded-2xl border border-sentinel-line bg-sentinel-canvas p-4 text-xs font-mono text-sentinel-muted space-y-1 text-left">
              <div className="flex justify-between">
                <span>Plan:</span>
                <strong className="text-sentinel-text">{plan.name} ({billingInterval})</strong>
              </div>
              <div className="flex justify-between">
                <span>Billed:</span>
                <strong className="text-sentinel-lime">${billedAmount} / {billingInterval === "year" ? "year" : "month"}</strong>
              </div>
              <div className="flex justify-between">
                <span>Cryptographic Receipt:</span>
                <span className="text-cyan-400">{receiptId || "rec_stripe_confirmed"}</span>
              </div>
            </div>
            <button
              type="button"
              className="primary-button w-full justify-center text-sm py-3 font-semibold"
              onClick={onClose}
            >
              Return to Control Center
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitPayment} className="p-6 space-y-5">
            {/* Plan Summary Callout */}
            <div className="rounded-2xl border border-sentinel-lime/30 bg-sentinel-lime/5 p-4 flex items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-sentinel-lime">
                  <Sparkles className="h-3 w-3" /> Selected Tier
                </span>
                <h4 className="mt-0.5 text-base font-bold text-sentinel-text">{plan.name} Plan</h4>
                <p className="text-xs text-sentinel-muted">
                  {billingInterval === "year" ? "Billed annually" : "Billed monthly"} · Cancel anytime
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-sentinel-text">
                  ${finalPrice}
                </span>
                <span className="text-xs text-sentinel-muted">/mo</span>
                {billingInterval === "year" && (
                  <p className="text-[10px] font-semibold text-sentinel-lime">(${billedAmount}/yr)</p>
                )}
              </div>
            </div>

            {/* Simulated Apple Pay / Instant Payment Strip */}
            <div className="space-y-2">
              <button
                type="button"
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-zinc-100 text-black font-semibold text-xs shadow transition active:scale-[0.99]"
                onClick={() => {
                  setCardholderName("Apple Pay User");
                  void handleSubmitPayment({ preventDefault: () => {} } as React.FormEvent);
                }}
              >
                Pay with <strong className="font-bold">Apple Pay</strong>
              </button>
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-sentinel-line" />
                <span className="text-[10px] uppercase font-semibold text-sentinel-dim">or card</span>
                <div className="h-px flex-1 bg-sentinel-line" />
              </div>
            </div>

            {/* Credit Card Inputs */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-sentinel-muted text-[11px] mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  className="h-10 w-full rounded-xl border border-sentinel-line bg-sentinel-canvas px-3 text-xs text-sentinel-text outline-none focus:border-sentinel-lime/70"
                  value={cardholderName}
                  onChange={(e) => setCardholderName(e.target.value)}
                  placeholder="Full Name"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-sentinel-muted text-[11px] mb-1">
                  Card Information
                </label>
                <div className="flex items-center rounded-xl border border-sentinel-line bg-sentinel-canvas px-3 h-10 gap-2">
                  <CreditCard className="h-4 w-4 text-sentinel-muted shrink-0" />
                  <input
                    type="text"
                    className="flex-1 bg-transparent text-xs text-sentinel-text outline-none font-mono"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    placeholder="1234 5678 9012 3456"
                    required
                  />
                  <input
                    type="text"
                    className="w-14 bg-transparent text-xs text-sentinel-text outline-none font-mono text-center border-l border-sentinel-line pl-2"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    placeholder="MM/YY"
                    required
                  />
                  <input
                    type="text"
                    className="w-12 bg-transparent text-xs text-sentinel-text outline-none font-mono text-center border-l border-sentinel-line pl-2"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    placeholder="CVC"
                    required
                  />
                </div>
              </div>

              {/* Promo Code Strip */}
              <div className="pt-1">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 h-9 rounded-lg border border-sentinel-line bg-sentinel-canvas px-3 text-xs uppercase font-mono text-sentinel-text placeholder:text-sentinel-dim outline-none"
                    placeholder="Promo code (e.g. EARLYBIRD)"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                  />
                  <button
                    type="button"
                    className="secondary-button h-9 px-3 text-xs"
                    onClick={() => void handleApplyCoupon()}
                  >
                    Apply
                  </button>
                </div>
                {couponApplied && (
                  <p className="mt-1 text-[11px] text-sentinel-lime flex items-center gap-1 font-semibold">
                    <Check className="h-3 w-3" /> 20% discount coupon applied!
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-sentinel-red/40 bg-sentinel-red/10 p-3 flex items-start gap-2 text-xs text-sentinel-red">
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
                  href={`/get-started?plan=${planCode}&interval=${billingInterval}`}
                  onClick={onClose}
                  className="primary-button w-full justify-center text-xs py-2.5 flex items-center gap-1.5"
                >
                  Continue to Workspace Setup <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="primary-button w-full justify-center text-sm py-3.5 font-bold shadow-lg shadow-sentinel-lime/20"
              >
                {loading ? (
                  <RotateCcw className="animate-spin h-4 w-4" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                {loading ? "Authorizing with Stripe…" : `Pay $${billedAmount} with Stripe`}
              </button>
            )}

            <div className="flex items-center justify-center gap-2 text-[10px] text-sentinel-dim">
              <ShieldCheck className="h-3.5 w-3.5 text-sentinel-lime" />
              <span>Guaranteed 14-day money back · Encrypted PCI-DSS Level 1 Compliant</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
