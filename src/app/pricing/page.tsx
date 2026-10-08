import type { Metadata } from "next";
import { headers } from "next/headers";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingFooter } from "@/components/landing/landing-footer";
import { PaddlePricingPage } from "@/components/pricing/paddle-pricing-page";
import { getPricingTiers, paddlePriceEnvironmentVariables, readPaddlePriceIds } from "@/lib/paddle-pricing";

export const metadata: Metadata = {
  title: "Pricing & Plans — SentinelOps",
  description:
    "Compare Starter, Pro, and Advanced plans for SentinelOps AI-agent governance, with monthly or annual billing and localized Paddle checkout.",
};

export default async function PricingPage() {
  const requestHeaders = await headers();
  const rawCountryCode = requestHeaders.get("x-vercel-ip-country")?.trim().toUpperCase();
  const countryCode = rawCountryCode && /^[A-Z]{2}$/.test(rawCountryCode)
    ? rawCountryCode
    : undefined;
  const priceIds = readPaddlePriceIds((name) => process.env[name]);
  const tiers = getPricingTiers(priceIds);
  const missingPriceVariables = Object.entries(paddlePriceEnvironmentVariables)
    .filter(([key]) => !priceIds[key as keyof typeof priceIds])
    .map(([, variable]) => variable);
  const paddleEnvironment = process.env.PADDLE_ENVIRONMENT;
  const configurationError = missingPriceVariables.length
    ? `Missing Paddle price ID environment variables: ${missingPriceVariables.join(", ")}.`
    : paddleEnvironment !== "sandbox" && paddleEnvironment !== "production"
      ? "PADDLE_ENVIRONMENT must be explicitly set to sandbox or production."
      : undefined;

  return (
    <div className="min-h-screen overflow-clip bg-sentinel-canvas font-sentinel text-sentinel-text">
      <LandingHeader />
      <main className="pt-20">
          <PaddlePricingPage
            countryCode={countryCode}
            tiers={tiers}
            expectedEnvironment={paddleEnvironment}
            configurationError={configurationError}
          />
      </main>
      <LandingFooter />
    </div>
  );
}
