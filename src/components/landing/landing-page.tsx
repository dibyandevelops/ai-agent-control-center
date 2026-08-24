import { HeroSection } from "./hero-section";
import { IntelligenceSection } from "./intelligence-section";
import { LandingFooter } from "./landing-footer";
import { LandingHeader } from "./landing-header";
import { SecuritySection } from "./security-section";
import { WorkflowSection } from "./workflow-section";
import { InteractiveSandbox } from "./interactive-sandbox";
import { PricingSection } from "./pricing-section";

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-clip bg-sentinel-canvas font-sentinel text-sentinel-text selection:bg-sentinel-lime selection:text-sentinel-canvas [&_a]:no-underline [&_button]:[-webkit-tap-highlight-color:transparent] [&_a]:[-webkit-tap-highlight-color:transparent] [&_:is(a,button):focus-visible]:outline [&_:is(a,button):focus-visible]:outline-2 [&_:is(a,button):focus-visible]:outline-offset-4 [&_:is(a,button):focus-visible]:outline-sentinel-lime">
      <LandingHeader />
      <main>
        <HeroSection />
        <InteractiveSandbox />
        <WorkflowSection />
        <IntelligenceSection />
        <SecuritySection />
        <PricingSection />
      </main>
      <LandingFooter />
    </div>
  );
}
