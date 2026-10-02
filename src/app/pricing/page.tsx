import type { Metadata } from "next";
import { headers } from "next/headers";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { PaddlePricingPage } from "@/components/pricing/paddle-pricing-page";

export const metadata: Metadata = {
  title: "Pricing & Plans — SentinelOps",
  description:
    "Predictable enterprise pricing for AI agent governance. Free pilot, team pro with self-serve subscription management, and sovereign enterprise deployments.",
};

export default async function PricingPage() {
  const requestHeaders = await headers();
  const rawCountryCode = requestHeaders.get("x-vercel-ip-country")?.trim().toUpperCase();
  const countryCode = rawCountryCode && /^[A-Z]{2}$/.test(rawCountryCode)
    ? rawCountryCode
    : undefined;

  return (
    <div className="min-h-screen overflow-clip bg-sentinel-canvas font-sentinel text-sentinel-text">
      <LandingHeader />
      <main className="pt-20">
          <PaddlePricingPage countryCode={countryCode} />
      </main>
      <LandingFooter />
    </div>
  );
}
