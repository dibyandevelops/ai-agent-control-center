"use client";

import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Download,
  FileText,
  FlaskConical,
  History,
  LoaderCircle,
  Lock,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";
import type { OperatorIdentity } from "@/lib/types";

export interface MockInvoice {
  id: string;
  number: string;
  date: string;
  amountDue: number;
  amountPaid: number;
  status: "paid" | "open" | "void" | "uncollectible";
  description: string;
  planName: string;
  periodStart: string;
  periodEnd: string;
}

export interface PaymentMethodInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  funding: string;
}

export interface SubscriptionData {
  planCode: PlanCode;
  planName: string;
  status: "not_configured" | "trialing" | "active" | "past_due" | "canceled" | "paused";
  billingInterval: "month" | "year";
  currentPeriodEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  paymentMethod: PaymentMethodInfo;
  limits: {
    agents: number | null;
    repositories: number | null;
    pendingApprovals: number | null;
    auditRetentionDays: number;
    httpsWebhooks: number | null;
  };
  pricing: {
    monthly: number;
    annual: number;
    currency: string;
  };
  invoices: MockInvoice[];
}

export function SubscriptionSettingsTab({
  operator,
  canManage,
}: {
  operator: OperatorIdentity | null;
  canManage: boolean;
}) {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<{ agents: number; repositories: number; pendingApprovals: number }>({
    agents: 3,
    repositories: 1,
    pendingApprovals: 2,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Dialog states
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<MockInvoice | null>(null);

  // Form states
  const [targetPlan, setTargetPlan] = useState<PlanCode>("pro");
  const [targetInterval, setTargetInterval] = useState<"month" | "year">("month");
  const [cancelReason, setCancelReason] = useState("Cost / Budget constraints");
  const [cancelImmediately, setCancelImmediately] = useState(false);
  const [pauseMonths, setPauseMonths] = useState(1);

  // Payment form states
  const [newCardBrand, setNewCardBrand] = useState("visa");
  const [newCardLast4, setNewCardLast4] = useState("4242");
  const [newCardExp, setNewCardExp] = useState("12/28");

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const res = await fetch("/api/v1/billing");
        if (res.ok && mounted) {
          const data = await res.json();
          if (data.subscription) {
            setSubscription(data.subscription);
            setTargetPlan(data.subscription.planCode);
            setTargetInterval(data.subscription.billingInterval);
          }
          if (data.usage) {
            setUsage(data.usage);
          }
        }
      } catch {
        // Fallback
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadData();
    return () => {
      mounted = false;
    };
  }, []);

  function notify(type: "success" | "error", message: string) {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  }

  async function handleUpdatePlan(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/billing/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "change_plan",
          planCode: targetPlan,
          billingInterval: targetInterval,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update subscription plan.");
      setSubscription(data.subscription);
      setShowPlanModal(false);
      notify("success", `Subscription successfully updated to ${planCatalog[targetPlan].name} (${targetInterval}ly).`);
    } catch (err: unknown) {
      notify("error", err instanceof Error ? err.message : "Failed to update plan.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancelSubscription(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/billing/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          immediately: cancelImmediately,
          reason: cancelReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to cancel subscription.");
      setSubscription(data.subscription);
      setShowCancelModal(false);
      notify(
        "success",
        cancelImmediately
          ? "Subscription cancelled immediately. Plan reverted to free Pilot."
          : "Subscription scheduled for cancellation at the end of the current billing cycle.",
      );
    } catch (err: unknown) {
      notify("error", err instanceof Error ? err.message : "Cancellation failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReactivate() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/billing/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reactivate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reactivate subscription.");
      setSubscription(data.subscription);
      notify("success", "Subscription reactivated! Quotas and governance rules have been restored.");
    } catch (err: unknown) {
      notify("error", err instanceof Error ? err.message : "Reactivation failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePauseSubscription(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/billing/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause", pauseMonths }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to pause subscription.");
      setSubscription(data.subscription);
      setShowPauseModal(false);
      notify("success", `Subscription paused for ${pauseMonths} month(s). Automatic renewals halted.`);
    } catch (err: unknown) {
      notify("error", err instanceof Error ? err.message : "Pause action failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleUpdatePayment(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/billing/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_payment_method",
          cardBrand: newCardBrand,
          cardLast4: newCardLast4,
          cardExp: newCardExp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update payment method.");
      setSubscription(data.subscription);
      setShowPaymentModal(false);
      notify("success", `Primary payment method updated to ${newCardBrand.toUpperCase()} •••• ${newCardLast4}.`);
    } catch (err: unknown) {
      notify("error", err instanceof Error ? err.message : "Payment update failed.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSimulateScenario(
    scenarioKey:
      | "active_pro"
      | "enterprise_annual"
      | "past_due"
      | "canceled_grace"
      | "paused_staging"
      | "pilot_reset",
  ) {
    setActionLoading(true);
    try {
      const res = await fetch("/api/v1/billing/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "simulate_scenario", scenarioKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scenario simulation failed.");
      setSubscription(data.subscription);
      notify("success", `Simulation Applied: Scenario '${scenarioKey}' active in test database.`);
    } catch (err: unknown) {
      notify("error", err instanceof Error ? err.message : "Simulation failed.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-sentinel-muted text-xs gap-2">
        <LoaderCircle className="h-4 w-4 animate-spin text-sentinel-lime" />
        Loading subscription and billing data…
      </div>
    );
  }

  const planCode = subscription?.planCode || "pro";
  const plan = planCatalog[planCode];
  const isCanceled = subscription?.status === "canceled" || subscription?.cancelAtPeriodEnd;
  const isPastDue = subscription?.status === "past_due";
  const isPaused = subscription?.status === "paused";
  const isActive = subscription?.status === "active" && !isCanceled;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl text-xs border animate-in fade-in duration-200 ${
            notification.type === "success"
              ? "bg-sentinel-lime/10 border-sentinel-lime/30 text-sentinel-lime"
              : "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Urgent Warning Banners */}
      {isPastDue && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-red-500/20 text-red-500 shrink-0">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-red-600 dark:text-red-400">
                Payment Past Due — Renewal Attempt Failed
              </h4>
              <p className="text-xs text-sentinel-muted mt-0.5">
                Your latest subscription renewal invoice failed to process. Update your card or retry payment to prevent policy enforcement downgrade.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowPaymentModal(true)}
            className="rounded-xl bg-red-600 text-white font-semibold px-4 py-2 text-xs hover:bg-red-700 transition shrink-0 w-full sm:w-auto"
          >
            Update Payment & Retry
          </button>
        </div>
      )}

      {isCanceled && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-500 shrink-0">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400">
                Subscription Scheduled for Cancellation
              </h4>
              <p className="text-xs text-sentinel-muted mt-0.5">
                Your organization retains {plan.name} limits until{" "}
                <span className="font-semibold text-sentinel-text">
                  {subscription?.currentPeriodEndsAt
                    ? new Date(subscription.currentPeriodEndsAt).toLocaleDateString()
                    : "end of period"}
                </span>
                . After that, limits will revert to free Pilot tier.
              </p>
            </div>
          </div>
          <button
            onClick={handleReactivate}
            disabled={actionLoading}
            className="rounded-xl bg-amber-600 text-white font-semibold px-4 py-2 text-xs hover:bg-amber-700 transition shrink-0 w-full sm:w-auto flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reactivate Subscription
          </button>
        </div>
      )}

      {isPaused && (
        <div className="rounded-2xl border border-blue-500/40 bg-blue-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-500 shrink-0">
              <Pause className="h-6 w-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-blue-600 dark:text-blue-400">Subscription Currently Paused</h4>
              <p className="text-xs text-sentinel-muted mt-0.5">
                Automatic renewal is paused. Your workspace is safe and existing policies remain configured.
              </p>
            </div>
          </div>
          <button
            onClick={handleReactivate}
            disabled={actionLoading}
            className="rounded-xl bg-blue-600 text-white font-semibold px-4 py-2 text-xs hover:bg-blue-700 transition shrink-0 w-full sm:w-auto flex items-center justify-center gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            Resume Subscription
          </button>
        </div>
      )}

      {/* Primary Plan Card */}
      <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-sentinel-line">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-sentinel-surface-raised border border-sentinel-line flex items-center justify-center text-sentinel-lime shadow-xs">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-sentinel-text">{plan.name} Plan</h3>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${
                    isActive
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 dark:text-sentinel-lime dark:border-sentinel-lime/30"
                      : isPastDue
                      ? "bg-red-500/10 text-red-500 border border-red-500/30"
                      : isCanceled
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                      : "bg-blue-500/10 text-blue-500 border border-blue-500/30"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {subscription?.status.replace("_", " ")}
                </span>
              </div>
              <p className="text-xs text-sentinel-muted mt-1">
                {planCode === "pilot"
                  ? "Free forever for developer evaluation and initial deployment."
                  : subscription?.billingInterval === "year"
                  ? `$${plan.priceAnnual}/month • Billed Annually ($${plan.priceAnnual * 12}/yr)`
                  : `$${plan.priceMonthly}/month • Billed Monthly`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {canManage && (
              <>
                <button
                  onClick={() => {
                    setTargetPlan(planCode);
                    setTargetInterval(subscription?.billingInterval || "month");
                    setShowPlanModal(true);
                  }}
                  className="primary-button text-xs py-2 px-3.5 flex items-center gap-1.5 w-full sm:w-auto justify-center"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Change Plan
                </button>

                {!isCanceled && planCode !== "pilot" && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="secondary-button text-xs py-2 px-3 text-red-500 hover:text-red-600 hover:border-red-500/30 w-full sm:w-auto justify-center"
                  >
                    Cancel Subscription
                  </button>
                )}

                {isCanceled && (
                  <button
                    onClick={handleReactivate}
                    disabled={actionLoading}
                    className="secondary-button text-xs py-2 px-3 text-sentinel-lime hover:border-sentinel-lime/40 w-full sm:w-auto justify-center"
                  >
                    Reactivate
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quotas & Capacity Usage */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="p-4 rounded-xl bg-sentinel-surface-raised border border-sentinel-line">
            <div className="text-[11px] font-semibold text-sentinel-muted uppercase tracking-wider">
              Autonomous Agents
            </div>
            <div className="text-xl font-bold text-sentinel-text mt-1.5 flex items-baseline gap-1.5">
              <span>{usage.agents}</span>
              <span className="text-xs text-sentinel-muted font-normal">
                / {plan.agents ? `${plan.agents} max` : "Unlimited"}
              </span>
            </div>
            <div className="mt-2.5 h-1.5 w-full rounded-full bg-sentinel-line overflow-hidden">
              <div
                className="h-full bg-sentinel-lime rounded-full"
                style={{
                  width: plan.agents ? `${Math.min(100, (usage.agents / plan.agents) * 100)}%` : "15%",
                }}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-sentinel-surface-raised border border-sentinel-line">
            <div className="text-[11px] font-semibold text-sentinel-muted uppercase tracking-wider">
              Cryptographic Audit
            </div>
            <div className="text-xl font-bold text-sentinel-text mt-1.5">
              {subscription?.limits.auditRetentionDays ?? plan.auditRetentionDays} Days
            </div>
            <p className="text-[11px] text-sentinel-muted mt-2">SHA-256 Merkle anchor chain</p>
          </div>

          <div className="p-4 rounded-xl bg-sentinel-surface-raised border border-sentinel-line">
            <div className="text-[11px] font-semibold text-sentinel-muted uppercase tracking-wider">
              Human Approvals Quorum
            </div>
            <div className="text-xl font-bold text-sentinel-text mt-1.5 flex items-baseline gap-1.5">
              <span>{usage.pendingApprovals}</span>
              <span className="text-xs text-sentinel-muted font-normal">
                / {plan.pendingApprovals ? `${plan.pendingApprovals} queue` : "Unlimited"}
              </span>
            </div>
            <p className="text-[11px] text-sentinel-muted mt-2">4-Eyes & Dual sign-off buffer</p>
          </div>

          <div className="p-4 rounded-xl bg-sentinel-surface-raised border border-sentinel-line">
            <div className="text-[11px] font-semibold text-sentinel-muted uppercase tracking-wider">
              Next Renewal Date
            </div>
            <div className="text-xl font-bold text-sentinel-text mt-1.5">
              {subscription?.currentPeriodEndsAt
                ? new Date(subscription.currentPeriodEndsAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Continuous"}
            </div>
            <p className="text-[11px] text-sentinel-muted mt-2">
              {isCanceled ? "Cancels at period end" : "Auto-renews automatically"}
            </p>
          </div>
        </div>

        {/* Action Controls Toolbar */}
        {canManage && (
          <div className="mt-6 pt-5 border-t border-sentinel-line flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {!isPaused && planCode !== "pilot" && (
                <button
                  onClick={() => setShowPauseModal(true)}
                  className="secondary-button text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Pause className="h-3 w-3" />
                  Pause Billing
                </button>
              )}
              {isPaused && (
                <button
                  onClick={handleReactivate}
                  className="secondary-button text-xs py-1.5 px-3 flex items-center gap-1.5 text-sentinel-lime"
                >
                  <Play className="h-3 w-3" />
                  Resume Billing
                </button>
              )}
            </div>

            <p className="text-[11px] text-sentinel-muted">
              Zero lock-in. Prorated upgrades are calculated in real time.
            </p>
          </div>
        )}
      </div>

      {/* Payment Method Details */}
      <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-sentinel-line">
          <div>
            <h4 className="text-sm font-bold text-sentinel-text flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-sentinel-lime" />
              Primary Payment Method
            </h4>
            <p className="text-xs text-sentinel-muted mt-0.5">
              Stored securely for automated renewals and overage settlements.
            </p>
          </div>

          {canManage && (
            <button
              onClick={() => setShowPaymentModal(true)}
              className="secondary-button text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              Update Payment Card
            </button>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between p-3.5 rounded-xl bg-sentinel-surface-raised border border-sentinel-line max-w-md">
          <div className="flex items-center gap-3">
            <div className="h-9 w-12 rounded-lg bg-sentinel-surface border border-sentinel-line flex items-center justify-center font-black text-[11px] uppercase tracking-wider text-sentinel-text">
              {subscription?.paymentMethod?.brand || "VISA"}
            </div>
            <div>
              <div className="text-xs font-bold text-sentinel-text">
                •••• •••• •••• {subscription?.paymentMethod?.last4 || "4242"}
              </div>
              <div className="text-[11px] text-sentinel-muted">
                Expires {subscription?.paymentMethod?.expMonth || 12}/{subscription?.paymentMethod?.expYear || 2028}
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-sentinel-lime border border-emerald-500/30">
            <Check className="h-2.5 w-2.5" />
            Verified
          </span>
        </div>
      </div>

      {/* 🧪 Subscription Testing Sandbox & Scenarios */}
      <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-5 sm:p-6 shadow-xs">
        <div className="flex items-start gap-3 pb-4 border-b border-purple-500/20">
          <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-500 shrink-0">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-sentinel-text">
                🧪 Subscription Sandbox & QA Scenario Simulator
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-600 dark:text-purple-300">
                Interactive Test Suite
              </span>
            </div>
            <p className="text-xs text-sentinel-muted mt-0.5">
              Simulate realistic enterprise billing lifecycles, delinquency recovery, and cancellation grace periods in the active workspace database.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-5">
          {/* Scenario 1 */}
          <button
            onClick={() => handleSimulateScenario("active_pro")}
            disabled={actionLoading}
            className="p-3.5 rounded-xl border border-sentinel-line bg-sentinel-surface hover:border-emerald-500/50 hover:bg-emerald-500/5 transition text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sentinel-text group-hover:text-emerald-500 transition">
                🟢 Active Pro Subscriber
              </span>
              <Sparkles className="h-3.5 w-3.5 text-sentinel-muted group-hover:text-emerald-500" />
            </div>
            <p className="text-[11px] text-sentinel-muted mt-1.5">
              Sets Pro plan with healthy Visa card, 27 days left in billing cycle, active SLA.
            </p>
          </button>

          {/* Scenario 2 */}
          <button
            onClick={() => handleSimulateScenario("enterprise_annual")}
            disabled={actionLoading}
            className="p-3.5 rounded-xl border border-sentinel-line bg-sentinel-surface hover:border-cyan-500/50 hover:bg-cyan-500/5 transition text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sentinel-text group-hover:text-cyan-500 transition">
                👑 Enterprise Annual VIP
              </span>
              <ShieldCheck className="h-3.5 w-3.5 text-sentinel-muted group-hover:text-cyan-500" />
            </div>
            <p className="text-[11px] text-sentinel-muted mt-1.5">
              Sets Enterprise annual plan ($2,988/yr), 10-year audit retention, unlimited quotas.
            </p>
          </button>

          {/* Scenario 3 */}
          <button
            onClick={() => handleSimulateScenario("past_due")}
            disabled={actionLoading}
            className="p-3.5 rounded-xl border border-sentinel-line bg-sentinel-surface hover:border-red-500/50 hover:bg-red-500/5 transition text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sentinel-text group-hover:text-red-500 transition">
                🔴 Past Due / Failed Card
              </span>
              <AlertTriangle className="h-3.5 w-3.5 text-sentinel-muted group-hover:text-red-500" />
            </div>
            <p className="text-[11px] text-sentinel-muted mt-1.5">
              Simulates failed renewal invoice of $79, triggers warning banner and retry prompt.
            </p>
          </button>

          {/* Scenario 4 */}
          <button
            onClick={() => handleSimulateScenario("canceled_grace")}
            disabled={actionLoading}
            className="p-3.5 rounded-xl border border-sentinel-line bg-sentinel-surface hover:border-amber-500/50 hover:bg-amber-500/5 transition text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sentinel-text group-hover:text-amber-500 transition">
                🟡 Cancellation Grace Period
              </span>
              <Clock className="h-3.5 w-3.5 text-sentinel-muted group-hover:text-amber-500" />
            </div>
            <p className="text-[11px] text-sentinel-muted mt-1.5">
              Marks subscription as canceling in 14 days, test reactivation workflows.
            </p>
          </button>

          {/* Scenario 5 */}
          <button
            onClick={() => handleSimulateScenario("paused_staging")}
            disabled={actionLoading}
            className="p-3.5 rounded-xl border border-sentinel-line bg-sentinel-surface hover:border-blue-500/50 hover:bg-blue-500/5 transition text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sentinel-text group-hover:text-blue-500 transition">
                ⏸️ Paused Project Hiatus
              </span>
              <Pause className="h-3.5 w-3.5 text-sentinel-muted group-hover:text-blue-500" />
            </div>
            <p className="text-[11px] text-sentinel-muted mt-1.5">
              Puts workspace in billing hiatus mode, disables renewal charges while keeping rules.
            </p>
          </button>

          {/* Scenario 6 */}
          <button
            onClick={() => handleSimulateScenario("pilot_reset")}
            disabled={actionLoading}
            className="p-3.5 rounded-xl border border-sentinel-line bg-sentinel-surface hover:border-sentinel-muted/50 hover:bg-sentinel-surface-raised transition text-left group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sentinel-text group-hover:text-sentinel-text transition">
                ⚪ Free Pilot Reset
              </span>
              <RefreshCw className="h-3.5 w-3.5 text-sentinel-muted" />
            </div>
            <p className="text-[11px] text-sentinel-muted mt-1.5">
              Resets workspace to default free 5-agent pilot tier with clear invoice ledger.
            </p>
          </button>
        </div>
      </div>

      {/* Invoices & Billing History */}
      <div className="rounded-2xl border border-sentinel-line bg-sentinel-surface p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-sentinel-line">
          <div>
            <h4 className="text-sm font-bold text-sentinel-text flex items-center gap-2">
              <History className="h-4 w-4 text-sentinel-lime" />
              Invoices & Billing History
            </h4>
            <p className="text-xs text-sentinel-muted mt-0.5">
              Itemized tax receipts with verifiable cryptographic transaction signatures.
            </p>
          </div>
        </div>

        {subscription?.invoices && subscription.invoices.length > 0 ? (
          <div className="mt-4 divide-y divide-sentinel-line border border-sentinel-line rounded-xl overflow-hidden">
            {subscription.invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 hover:bg-sentinel-surface-raised transition gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-sentinel-surface border border-sentinel-line text-sentinel-muted shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-sentinel-text font-mono">{inv.number}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          inv.status === "paid"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-sentinel-lime"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-sentinel-muted mt-0.5">
                      {new Date(inv.date).toLocaleDateString()} • {inv.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
                  <span className="text-xs font-bold text-sentinel-text">
                    ${inv.amountDue.toFixed(2)} USD
                  </span>
                  <button
                    onClick={() => setSelectedInvoice(inv)}
                    className="secondary-button text-[11px] py-1 px-2.5 flex items-center gap-1"
                  >
                    View Receipt
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 p-6 rounded-xl border border-sentinel-line bg-sentinel-surface-raised text-center">
            <p className="text-xs text-sentinel-muted">No past invoices generated for this workspace yet.</p>
          </div>
        )}
      </div>

      {/* MODAL 1: Change / Upgrade / Downgrade Plan */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-2xl border border-sentinel-line bg-sentinel-surface p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-sentinel-line">
              <div>
                <h3 className="text-base font-bold text-sentinel-text">Change Subscription Plan</h3>
                <p className="text-xs text-sentinel-muted mt-0.5">
                  Select your desired governance tier and billing cadence.
                </p>
              </div>
              <button
                onClick={() => setShowPlanModal(false)}
                className="p-1 rounded-lg text-sentinel-muted hover:text-sentinel-text hover:bg-sentinel-surface-raised"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Billing Interval Toggle */}
            <div className="flex items-center justify-center">
              <div className="inline-flex rounded-xl border border-sentinel-line bg-sentinel-surface-raised p-1">
                <button
                  type="button"
                  onClick={() => setTargetInterval("month")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition ${
                    targetInterval === "month"
                      ? "bg-sentinel-surface text-sentinel-text shadow-xs"
                      : "text-sentinel-muted"
                  }`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setTargetInterval("year")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${
                    targetInterval === "year"
                      ? "bg-emerald-600 dark:bg-sentinel-lime text-white dark:text-sentinel-canvas shadow-xs"
                      : "text-sentinel-muted"
                  }`}
                >
                  <span>Annually</span>
                  <span className="text-[10px] rounded-full bg-white/20 dark:bg-black/20 px-1.5 py-0.2">
                    Save 20%
                  </span>
                </button>
              </div>
            </div>

            {/* Plan Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(["pilot", "pro", "enterprise"] as PlanCode[]).map((code) => {
                const item = planCatalog[code];
                const isSelected = targetPlan === code;
                const price = targetInterval === "year" ? item.priceAnnual : item.priceMonthly;

                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setTargetPlan(code)}
                    className={`p-4 rounded-xl border text-left transition relative ${
                      isSelected
                        ? "border-sentinel-lime bg-sentinel-lime/5 shadow-xs"
                        : "border-sentinel-line bg-sentinel-surface-raised hover:border-sentinel-line-strong"
                    }`}
                  >
                    {code === "pro" && (
                      <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-600 dark:bg-sentinel-lime text-white dark:text-sentinel-canvas">
                        Popular
                      </span>
                    )}
                    <div className="text-xs font-bold text-sentinel-text">{item.name}</div>
                    <div className="text-base font-black text-sentinel-text mt-2">
                      ${price}
                      <span className="text-[10px] text-sentinel-muted font-normal">/mo</span>
                    </div>
                    <ul className="mt-3 space-y-1 text-[11px] text-sentinel-muted">
                      <li>• {item.agents ? `${item.agents} Agents` : "Unlimited Agents"}</li>
                      <li>• {item.auditRetentionDays} Days Audit</li>
                    </ul>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-sentinel-line">
              <button
                type="button"
                onClick={() => setShowPlanModal(false)}
                className="secondary-button text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdatePlan}
                disabled={actionLoading}
                className="primary-button text-xs py-2 px-4 flex items-center gap-1.5"
              >
                {actionLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                Confirm Plan Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Cancel Subscription */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-sentinel-surface p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 text-red-500 shrink-0">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-sentinel-text">Cancel Subscription</h3>
                <p className="text-xs text-sentinel-muted mt-1 leading-relaxed">
                  We are sorry to see you go. Your autonomous agents will lose enterprise quorum approvals and audit retention when the cancellation completes.
                </p>
              </div>
            </div>

            <form onSubmit={handleCancelSubscription} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-sentinel-text mb-1.5">
                  Reason for Cancellation
                </label>
                <select
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full h-10 rounded-xl border border-sentinel-line bg-sentinel-surface-raised px-3 text-xs text-sentinel-text outline-none focus:border-sentinel-lime"
                >
                  <option value="Cost / Budget constraints">Cost / Budget constraints</option>
                  <option value="Temporary project concluded">Temporary project concluded</option>
                  <option value="Missing policy engine features">Missing policy engine features</option>
                  <option value="Switching to self-hosted VPC">Switching to self-hosted VPC</option>
                  <option value="Other">Other reason</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl border border-sentinel-line bg-sentinel-surface-raised space-y-2">
                <label className="flex items-center gap-2.5 text-xs text-sentinel-text cursor-pointer">
                  <input
                    type="radio"
                    name="cancelTiming"
                    checked={!cancelImmediately}
                    onChange={() => setCancelImmediately(false)}
                    className="accent-emerald-500"
                  />
                  <span>
                    <strong>Cancel at end of billing cycle</strong> (Recommended — keep access through{" "}
                    {subscription?.currentPeriodEndsAt
                      ? new Date(subscription.currentPeriodEndsAt).toLocaleDateString()
                      : "period end"}
                    )
                  </span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-sentinel-text cursor-pointer">
                  <input
                    type="radio"
                    name="cancelTiming"
                    checked={cancelImmediately}
                    onChange={() => setCancelImmediately(true)}
                    className="accent-red-500"
                  />
                  <span>
                    <strong>Cancel immediately</strong> (Revert to free Pilot tier right now)
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-sentinel-line">
                <button
                  type="button"
                  onClick={() => setShowCancelModal(false)}
                  className="secondary-button text-xs py-2 px-4"
                >
                  Keep Subscription
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="rounded-xl bg-red-600 text-white font-semibold px-4 py-2 text-xs hover:bg-red-700 transition flex items-center gap-1.5"
                >
                  {actionLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  Confirm Cancellation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Update Payment Method */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-sentinel-line bg-sentinel-surface p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-sentinel-line">
              <h3 className="text-base font-bold text-sentinel-text">Update Payment Card</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg text-sentinel-muted hover:text-sentinel-text hover:bg-sentinel-surface-raised"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Quick Test Card Presets */}
            <div>
              <label className="block text-[11px] font-semibold text-sentinel-muted uppercase tracking-wider mb-2">
                Quick Test Card Presets
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNewCardBrand("visa");
                    setNewCardLast4("4242");
                    setNewCardExp("12/28");
                  }}
                  className="p-2 rounded-xl border border-sentinel-line bg-sentinel-surface-raised hover:border-sentinel-lime text-center text-xs font-bold"
                >
                  Visa 4242
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewCardBrand("mastercard");
                    setNewCardLast4("5555");
                    setNewCardExp("10/29");
                  }}
                  className="p-2 rounded-xl border border-sentinel-line bg-sentinel-surface-raised hover:border-sentinel-lime text-center text-xs font-bold"
                >
                  Mastercard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewCardBrand("amex");
                    setNewCardLast4("1005");
                    setNewCardExp("05/30");
                  }}
                  className="p-2 rounded-xl border border-sentinel-line bg-sentinel-surface-raised hover:border-sentinel-lime text-center text-xs font-bold"
                >
                  Amex 1005
                </button>
              </div>
            </div>

            <form onSubmit={handleUpdatePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-sentinel-text mb-1">Card Brand</label>
                <select
                  value={newCardBrand}
                  onChange={(e) => setNewCardBrand(e.target.value)}
                  className="w-full h-10 rounded-xl border border-sentinel-line bg-sentinel-surface-raised px-3 text-xs text-sentinel-text outline-none focus:border-sentinel-lime capitalize"
                >
                  <option value="visa">Visa</option>
                  <option value="mastercard">Mastercard</option>
                  <option value="amex">American Express</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-sentinel-text mb-1">Last 4 Digits</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={newCardLast4}
                    onChange={(e) => setNewCardLast4(e.target.value.replace(/\D/g, ""))}
                    className="w-full h-10 rounded-xl border border-sentinel-line bg-sentinel-surface-raised px-3 text-xs text-sentinel-text font-mono outline-none focus:border-sentinel-lime"
                    placeholder="4242"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-sentinel-text mb-1">Expiration (MM/YY)</label>
                  <input
                    type="text"
                    maxLength={5}
                    value={newCardExp}
                    onChange={(e) => setNewCardExp(e.target.value)}
                    className="w-full h-10 rounded-xl border border-sentinel-line bg-sentinel-surface-raised px-3 text-xs text-sentinel-text font-mono outline-none focus:border-sentinel-lime"
                    placeholder="12/28"
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-sentinel-line">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="secondary-button text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="primary-button text-xs py-2 px-4 flex items-center gap-1.5"
                >
                  {actionLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  Save Card
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Pause Subscription */}
      {showPauseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-sentinel-line bg-sentinel-surface p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-sentinel-line">
              <h3 className="text-base font-bold text-sentinel-text">Pause Subscription Billing</h3>
              <button
                onClick={() => setShowPauseModal(false)}
                className="p-1 rounded-lg text-sentinel-muted hover:text-sentinel-text hover:bg-sentinel-surface-raised"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-sentinel-muted leading-relaxed">
              Pausing halts upcoming billing renewals while preserving all agent API keys, policies, and cryptographic logs. You can resume anytime.
            </p>

            <form onSubmit={handlePauseSubscription} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-sentinel-text mb-1">Pause Duration</label>
                <select
                  value={pauseMonths}
                  onChange={(e) => setPauseMonths(Number(e.target.value))}
                  className="w-full h-10 rounded-xl border border-sentinel-line bg-sentinel-surface-raised px-3 text-xs text-sentinel-text outline-none focus:border-sentinel-lime"
                >
                  <option value={1}>1 Month</option>
                  <option value={2}>2 Months</option>
                  <option value={3}>3 Months</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-sentinel-line">
                <button
                  type="button"
                  onClick={() => setShowPauseModal(false)}
                  className="secondary-button text-xs py-2 px-4"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="primary-button text-xs py-2 px-4 flex items-center gap-1.5"
                >
                  {actionLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                  Pause Billing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: Itemized Invoice Receipt Viewer */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-sentinel-line bg-sentinel-surface p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between pb-4 border-b border-sentinel-line">
              <div>
                <div className="text-xs font-semibold text-sentinel-lime uppercase tracking-wider">
                  Official Tax Receipt
                </div>
                <h3 className="text-lg font-bold text-sentinel-text mt-0.5">{selectedInvoice.number}</h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-1 rounded-lg text-sentinel-muted hover:text-sentinel-text hover:bg-sentinel-surface-raised"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-sentinel-surface-raised border border-sentinel-line">
                <div>
                  <span className="text-sentinel-muted block text-[11px]">Billed To</span>
                  <strong className="text-sentinel-text">{operator?.organizationName || "Aperture Labs"}</strong>
                  <div className="text-sentinel-muted font-mono text-[10px] mt-0.5">
                    {operator?.organizationId || "org_primary"}
                  </div>
                </div>
                <div>
                  <span className="text-sentinel-muted block text-[11px]">Issue Date</span>
                  <strong className="text-sentinel-text">
                    {new Date(selectedInvoice.date).toLocaleDateString()}
                  </strong>
                  <div className="text-sentinel-muted text-[10px] mt-0.5">Payment Method: Card •••• 4242</div>
                </div>
              </div>

              {/* Line items */}
              <div className="border border-sentinel-line rounded-xl overflow-hidden">
                <div className="p-3 bg-sentinel-surface-raised font-semibold flex justify-between border-b border-sentinel-line">
                  <span>Description</span>
                  <span>Amount</span>
                </div>
                <div className="p-3 flex justify-between">
                  <div>
                    <div className="font-semibold text-sentinel-text">{selectedInvoice.description}</div>
                    <div className="text-sentinel-muted text-[11px]">
                      Covers full autonomous agent policy evaluation quotas and audit anchoring.
                    </div>
                  </div>
                  <span className="font-bold text-sentinel-text shrink-0">
                    ${selectedInvoice.amountDue.toFixed(2)}
                  </span>
                </div>
                <div className="p-3 bg-sentinel-surface-raised flex justify-between font-bold border-t border-sentinel-line">
                  <span>Total Paid (USD)</span>
                  <span className="text-sentinel-lime">${selectedInvoice.amountPaid.toFixed(2)}</span>
                </div>
              </div>

              <div className="text-[11px] text-sentinel-muted flex items-center gap-1.5 justify-center">
                <Lock className="h-3 w-3 text-emerald-500" />
                Cryptographically sealed & anchored to SentinelOps zero-trust ledger.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-sentinel-line">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="secondary-button text-xs py-2 px-3.5 flex items-center gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Print / Save PDF
              </button>
              <button
                type="button"
                onClick={() => setSelectedInvoice(null)}
                className="primary-button text-xs py-2 px-4"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
