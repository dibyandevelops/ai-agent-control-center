import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";

export const metadata: Metadata = {
  title: "Welcome — SentinelOps",
  description: "Your SentinelOps checkout is complete.",
  robots: { index: false, follow: false },
};

export default function WelcomePage() {
  return (
    <div className="min-h-screen overflow-clip bg-sentinel-canvas font-sentinel text-sentinel-text">
      <LandingHeader />
      <main className="mx-auto flex min-h-[65vh] max-w-3xl flex-col items-center justify-center px-6 py-20 text-center">
        <CheckCircle2 className="h-14 w-14 text-sentinel-lime" aria-hidden="true" />
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-sentinel-lime">Checkout complete</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">Welcome to SentinelOps</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-sentinel-muted">
          Thanks for choosing SentinelOps. Check your inbox for the Paddle receipt and subscription details.
        </p>
        <Link href="/get-started" className="primary-button mt-8 px-6 py-3 text-sm font-bold">
          Continue to workspace setup
        </Link>
      </main>
      <LandingFooter />
    </div>
  );
}
