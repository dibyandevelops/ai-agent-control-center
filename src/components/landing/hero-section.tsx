import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DashboardPreview } from "./dashboard-preview";
import styles from "./landing.module.css";

export function HeroSection() {
  return (
    <section className={styles.hero} id="product">
      <div className={styles.heroCopy}>
        <h1>
          Every AI agent.<br />
          Every action.<br />
          <span>Under control.</span>
        </h1>
        <p>
          SentinelOps gives security and AI teams one enforcement layer to discover
          agents, approve high-risk actions, and prove what happened.
        </p>
        <div className={styles.heroActions}>
          <a href="#contact" className={styles.primaryCta}>
            Book a demo <ArrowRight />
          </a>
          <Link href="/dashboard" className={styles.secondaryCta}>
            Explore control center <ArrowRight />
          </Link>
        </div>
        <div className={styles.audience}>
          Built for Security <i /> AI Ops <i /> Compliance <i /> Platform teams
        </div>
      </div>
      <div className={styles.heroSignal} aria-hidden="true"><span /></div>
      <div className={styles.heroPreview}>
        <DashboardPreview />
      </div>
    </section>
  );
}
