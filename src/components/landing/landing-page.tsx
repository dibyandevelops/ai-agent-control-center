import { HeroSection } from "./hero-section";
import { LandingFooter } from "./landing-footer";
import { LandingHeader } from "./landing-header";
import { SecuritySection } from "./security-section";
import { WorkflowSection } from "./workflow-section";
import styles from "./landing.module.css";

export function LandingPage() {
  return (
    <div className={styles.landing}>
      <LandingHeader />
      <main>
        <HeroSection />
        <WorkflowSection />
        <SecuritySection />
      </main>
      <LandingFooter />
    </div>
  );
}
