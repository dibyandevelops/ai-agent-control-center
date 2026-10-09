import type { Metadata } from "next";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { FreePilotPricingPage } from "@/components/pricing/free-pilot-pricing-page";

export const metadata: Metadata = {
  title: "Pricing & Plans — SentinelOps",
  description:
    "Start with the free SentinelOps pilot for AI-agent governance. Larger Starter, Pro, and Advanced plans are planned for the future.",
};

export default function PricingPage() {
  return (
    <div className="min-h-screen overflow-clip bg-sentinel-canvas font-sentinel text-sentinel-text">
      <LandingHeader />
      <main className="pt-20">
        <FreePilotPricingPage />
      </main>
      <LandingFooter />
    </div>
  );
}
