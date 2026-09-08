"use client";

import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  CreditCard,
  Lock,
  Minus,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import { planCatalog, type PlanCode } from "@/lib/plan-catalog";
import { DodoPaymentsCheckoutDialog } from "@/components/pricing/dodo-payments-checkout-dialog";

export function PricingSection() {
  const router = useRouter();
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("year");
  const [checkoutPlan, setCheckoutPlan] = useState<PlanCode | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  async function handlePlanClick(plan: PlanCode) {
    if (plan === "pilot") {
      router.push("/get-started");
      return;
    }

    try {
      const res = await fetch("/api/v1/session/profile");
      if (res.ok) {
        // Logged-in operator -> open modal to upgrade active workspace
        setCheckoutPlan(plan);
        return;
      }
    } catch {
      // Fallback to onboarding
    }

    // Unauthenticated user -> redirect to workspace creation with selected tier
    router.push(`/get-started?plan=${plan}&interval=${billingInterval}`);
  }

  const faqs = [
    {
      q: "How does the interactive 5-second Undo grace period work?",
      a: "When an approver clicks Approve or Deny in Slack or the web dashboard, SentinelOps holds the decision in an optimistic reversible buffer for 5 seconds. Operators can click 'Undo' to cancel mistakes before irreversible downstream tool dispatch occurs.",
    },
    {
      q: "How are SOC 2 and ISO 27001 compliance evidence packages generated?",
      a: "SentinelOps generates one-click cryptographically signed attestation certificates. Every agent call, approver identity, policy rule, and timestamp is anchored into a tamper-evident SHA-256 Merkle chain that auditors can independently verify.",
    },
    {
      q: "How does SentinelOps count and discover agents?",
      a: "SentinelOps integrates via lightweight decorators (Python SDK, TypeScript SDK), API gateway proxies, or VCS webhooks. Every unique agent credential or identity that evaluates policy is tracked as an active agent.",
    },
    {
      q: "Can we self-host SentinelOps or run in a private VPC?",
      a: "Yes. Enterprise customers can deploy the SentinelOps control plane in their AWS, Azure, or GCP private VPC with zero egress and local cryptographic audit anchoring.",
    },
    {
      q: "How does the sub-20ms policy enforcement SLA work?",
      a: "Our distributed in-memory evaluation cache evaluates pre-compiled deterministic rules and velocity boundaries in sub-20ms before requests reach downstream tool APIs.",
    },
    {
      q: "What bot defense protects workspace authentication?",
      a: "SentinelOps integrates Cloudflare Turnstile bot verification on sign-in and workspace creation modals to eliminate automated credential stuffing without degrading the developer experience.",
    },
    {
      q: "How does Lemon Squeezy subscription billing and international tax work?",
      a: "All subscriptions, prorated upgrades, and localized tax invoicing are processed securely through Lemon Squeezy as our Merchant of Record. They automatically calculate and remit Australian GST, US sales tax, and EU VAT, while supporting credit cards, Apple Pay, PayPal, and bank transfers worldwide.",
    },
  ];

  return (
    <section className="relative mx-auto max-w-[1380px] px-6 py-20 lg:py-28" id="pricing">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-emerald-500/10 dark:bg-sentinel-lime/10 blur-[140px] rounded-full pointer-events-none -z-10" />

      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 dark:border-sentinel-lime/30 bg-emerald-500/10 dark:bg-sentinel-lime/10 px-3.5 py-1 text-xs font-semibold text-emerald-700 dark:text-sentinel-lime mb-4">
          <Sparkles className="h-3.5 w-3.5" /> Transparent Enterprise Pricing
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-sentinel-text">
          Predictable Control. Zero Risk.
        </h2>
        <p className="mt-4 text-base sm:text-lg text-sentinel-muted leading-relaxed">
          Start for free with your first 5 AI agents, then scale securely with self-serve billing or tailored enterprise agreements.
        </p>

        {/* Billing Cycle Switcher */}
        <div className="mt-8 inline-flex items-center rounded-2xl border border-sentinel-line bg-sentinel-surface p-1.5 shadow-sm">
          <button
            type="button"
            className={`rounded-xl px-5 py-2 text-xs font-bold transition ${
              billingInterval === "month"
                ? "bg-sentinel-raised text-sentinel-text shadow-sm"
                : "text-sentinel-muted hover:text-sentinel-text"
            }`}
            onClick={() => setBillingInterval("month")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`rounded-xl px-5 py-2 text-xs font-bold transition flex items-center gap-2 ${
              billingInterval === "year"
                ? "bg-emerald-600 dark:bg-sentinel-lime text-white dark:text-sentinel-canvas shadow-sm"
                : "text-sentinel-muted hover:text-sentinel-text"
            }`}
            onClick={() => setBillingInterval("year")}
          >
            <span>Annually</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                billingInterval === "year"
                  ? "bg-white/20 dark:bg-sentinel-canvas/80 text-white dark:text-sentinel-lime"
                  : "bg-emerald-500/20 text-emerald-700 dark:text-sentinel-lime"
              }`}
            >
              SAVE 20%
            </span>
          </button>
        </div>
      </div>

      {/* 3 Pricing Tier Cards */}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-stretch mb-20">
        {/* Tier 1: Pilot / Developer */}
        <div className="flex flex-col justify-between rounded-3xl border border-sentinel-line bg-sentinel-surface p-8 shadow-sm transition hover:border-sentinel-line-strong hover:shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-sentinel-text">Pilot</h3>
              <span className="rounded-full border border-sentinel-line bg-sentinel-canvas px-2.5 py-0.5 text-[11px] font-semibold text-sentinel-muted">
                Free Forever
              </span>
            </div>
            <p className="mt-2 text-xs text-sentinel-muted leading-relaxed">
              Validate governed agent workflows with your immediate team.
            </p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-black text-sentinel-text">$0</span>
              <span className="text-xs text-sentinel-muted">/ month</span>
            </div>

            <ul className="mt-8 space-y-3.5 text-xs text-sentinel-muted">
              {planCatalog.pilot.features.map((feat) => (
                <li key={feat} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-sentinel-lime shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <Link
            href="/get-started"
            className="secondary-button mt-8 w-full justify-center py-3 text-xs font-bold"
          >
            Start Free Workspace <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Tier 2: Team Pro (Featured) */}
        <div className="relative flex flex-col justify-between rounded-3xl border-2 border-emerald-600 dark:border-sentinel-lime bg-sentinel-surface p-8 shadow-xl shadow-emerald-500/10 dark:shadow-sentinel-lime/10 lg:-translate-y-2 z-10">
          <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-emerald-600 dark:bg-sentinel-lime px-3.5 py-1 text-[10px] font-black uppercase tracking-wider text-white dark:text-sentinel-canvas shadow-sm">
            Most Popular
          </div>
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-sentinel-text">Team Pro</h3>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 dark:border-sentinel-lime/40 dark:bg-sentinel-lime/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-sentinel-lime">
                Self-Serve Upgrade
              </span>
            </div>
            <p className="mt-2 text-xs text-sentinel-muted leading-relaxed">
              Scale production AI agents with multi-party sign-offs & instant quarantine.
            </p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-black text-sentinel-text">
                ${billingInterval === "year" ? planCatalog.pro.priceAnnual : planCatalog.pro.priceMonthly}
              </span>
              <span className="text-xs text-sentinel-muted">/ month</span>
              {billingInterval === "year" && (
                <span className="ml-2 text-[11px] font-semibold text-emerald-700 dark:text-sentinel-lime">
                  billed annually
                </span>
              )}
            </div>

            <ul className="mt-8 space-y-3.5 text-xs text-sentinel-text font-medium">
              {planCatalog.pro.features.map((feat) => (
                <li key={feat} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-emerald-600 dark:text-sentinel-lime shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            className="primary-button mt-8 w-full justify-center py-3.5 text-xs font-bold shadow-lg shadow-emerald-500/25 dark:shadow-sentinel-lime/25"
            onClick={() => void handlePlanClick("pro")}
          >
            <Zap className="h-4 w-4" /> Upgrade to Team Pro
          </button>
        </div>

        {/* Tier 3: Enterprise Security */}
        <div className="flex flex-col justify-between rounded-3xl border border-sentinel-line bg-sentinel-surface p-8 shadow-sm transition hover:border-sentinel-line-strong hover:shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-sentinel-text">Enterprise</h3>
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-500 dark:text-cyan-400">
                Full Sovereignty
              </span>
            </div>
            <p className="mt-2 text-xs text-sentinel-muted leading-relaxed">
              Total governance sovereignty for regulated healthcare, fintech, and defense.
            </p>
            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-black text-sentinel-text">
                ${billingInterval === "year" ? planCatalog.enterprise.priceAnnual : planCatalog.enterprise.priceMonthly}
              </span>
              <span className="text-xs text-sentinel-muted">/ month</span>
            </div>

            <ul className="mt-8 space-y-3.5 text-xs text-sentinel-muted">
              {planCatalog.enterprise.features.map((feat) => (
                <li key={feat} className="flex items-start gap-2.5">
                  <Check className="h-4 w-4 text-cyan-500 dark:text-cyan-400 shrink-0 mt-0.5" />
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            className="secondary-button mt-8 w-full justify-center py-3 text-xs font-bold hover:border-cyan-500/60"
            onClick={() => void handlePlanClick("enterprise")}
          >
            Upgrade to Enterprise <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Trust & Compliance Badge Strip */}
      <div className="mb-20 grid grid-cols-2 md:grid-cols-4 gap-4 p-6 rounded-2xl border border-sentinel-line bg-sentinel-surface/60 backdrop-blur-sm text-center">
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-sentinel-lime">
            <Lock className="h-4 w-4" />
            <strong className="text-xs font-bold text-sentinel-text">PCI-DSS Level 1</strong>
          </div>
          <p className="text-[10px] text-sentinel-muted">Encrypted Tokenization</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-sentinel-lime">
            <CreditCard className="h-4 w-4" />
            <strong className="text-xs font-bold text-sentinel-text">Global Payments</strong>
          </div>
          <p className="text-[10px] text-sentinel-muted">Cards, SEPA, ACH, Apple Pay</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-cyan-500">
            <Building2 className="h-4 w-4" />
            <strong className="text-xs font-bold text-sentinel-text">Net-30 Invoicing</strong>
          </div>
          <p className="text-[10px] text-sentinel-muted">Enterprise Purchase Orders</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-amber-500">
            <ShieldCheck className="h-4 w-4" />
            <strong className="text-xs font-bold text-sentinel-text">SOC 2 Type II</strong>
          </div>
          <p className="text-[10px] text-sentinel-muted">Continuous Compliance Audit</p>
        </div>
      </div>

      {/* Feature Comparison Matrix */}
      <div className="rounded-3xl border border-sentinel-line bg-sentinel-surface/80 p-8 shadow-sm mb-20 overflow-x-auto">
        <h3 className="text-xl font-bold text-sentinel-text mb-6">Detailed Feature Comparison</h3>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-sentinel-line text-sentinel-muted">
              <th className="pb-3 font-semibold">Governance Capability</th>
              <th className="pb-3 font-semibold text-center w-36">Pilot</th>
              <th className="pb-3 font-semibold text-center w-36 text-emerald-700 dark:text-sentinel-lime">Team Pro</th>
              <th className="pb-3 font-semibold text-center w-36 text-cyan-500 dark:text-cyan-400">Enterprise</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sentinel-line/60">
            <tr>
              <td className="py-3.5 font-medium text-sentinel-text">Active Agent Registrations</td>
              <td className="py-3.5 text-center text-sentinel-muted">5</td>
              <td className="py-3.5 text-center font-bold text-sentinel-text">25</td>
              <td className="py-3.5 text-center font-bold text-emerald-600 dark:text-sentinel-lime">Unlimited</td>
            </tr>
            <tr>
              <td className="py-3.5 font-medium text-sentinel-text">Sub-20ms Policy Engine</td>
              <td className="py-3.5 text-center text-emerald-600 dark:text-sentinel-lime"><Check className="h-4 w-4 mx-auto" /></td>
              <td className="py-3.5 text-center text-emerald-600 dark:text-sentinel-lime"><Check className="h-4 w-4 mx-auto" /></td>
              <td className="py-3.5 text-center text-emerald-600 dark:text-sentinel-lime"><Check className="h-4 w-4 mx-auto" /></td>
            </tr>
            <tr>
              <td className="py-3.5 font-medium text-sentinel-text">Dual-Custody Quorum Sign-offs</td>
              <td className="py-3.5 text-center text-sentinel-dim"><Minus className="h-4 w-4 mx-auto" /></td>
              <td className="py-3.5 text-center text-emerald-600 dark:text-sentinel-lime"><Check className="h-4 w-4 mx-auto" /></td>
              <td className="py-3.5 text-center text-emerald-600 dark:text-sentinel-lime"><Check className="h-4 w-4 mx-auto" /></td>
            </tr>
            <tr>
              <td className="py-3.5 font-medium text-sentinel-text">Cryptographic Audit Immutability</td>
              <td className="py-3.5 text-center text-sentinel-muted">90 Days</td>
              <td className="py-3.5 text-center font-semibold text-sentinel-text">1 Year</td>
              <td className="py-3.5 text-center font-bold text-emerald-600 dark:text-sentinel-lime">10 Years</td>
            </tr>
            <tr>
              <td className="py-3.5 font-medium text-sentinel-text">SAML 2.0 & SCIM User Provisioning</td>
              <td className="py-3.5 text-center text-sentinel-dim"><Minus className="h-4 w-4 mx-auto" /></td>
              <td className="py-3.5 text-center text-sentinel-dim"><Minus className="h-4 w-4 mx-auto" /></td>
              <td className="py-3.5 text-center text-emerald-600 dark:text-sentinel-lime"><Check className="h-4 w-4 mx-auto" /></td>
            </tr>
            <tr>
              <td className="py-3.5 font-medium text-sentinel-text">Private VPC / Air-Gapped Gateway</td>
              <td className="py-3.5 text-center text-sentinel-dim"><Minus className="h-4 w-4 mx-auto" /></td>
              <td className="py-3.5 text-center text-sentinel-dim"><Minus className="h-4 w-4 mx-auto" /></td>
              <td className="py-3.5 text-center text-emerald-600 dark:text-sentinel-lime"><Check className="h-4 w-4 mx-auto" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Frequently Asked Questions */}
      <div className="max-w-3xl mx-auto">
        <h3 className="text-2xl font-bold text-sentinel-text text-center mb-8">
          Frequently Asked Questions
        </h3>
        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={faq.q}
                className="rounded-2xl border border-sentinel-line bg-sentinel-surface overflow-hidden transition"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-5 text-left text-sm font-semibold text-sentinel-text hover:text-emerald-600 dark:hover:text-sentinel-lime"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-sentinel-muted transition-transform duration-200 ${
                      isOpen ? "rotate-180 text-emerald-600 dark:text-sentinel-lime" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-sentinel-muted leading-relaxed border-t border-sentinel-line/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Dodo Payments Checkout Modal */}
      {checkoutPlan && (
        <DodoPaymentsCheckoutDialog
          open={Boolean(checkoutPlan)}
          planCode={checkoutPlan}
          billingInterval={billingInterval}
          onClose={() => setCheckoutPlan(null)}
          onSuccess={() => {
            setCheckoutPlan(null);
          }}
        />
      )}
    </section>
  );
}
