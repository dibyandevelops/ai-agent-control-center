import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { PricingSection } from "@/components/landing/pricing-section";

export const metadata: Metadata = {
  title: "Pricing & Plans — SentinelOps",
  description:
    "Predictable enterprise pricing for AI agent governance. Free pilot, team pro with Stripe billing, and sovereign enterprise deployments.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen overflow-clip bg-sentinel-canvas font-sentinel text-sentinel-text">
      <LandingHeader />
      <main className="pt-20">
        <PricingSection />
      </main>
      <LandingFooter />
    </div>
  );
}
