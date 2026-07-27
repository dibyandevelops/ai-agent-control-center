import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "./brand";
import styles from "./landing.module.css";

export function LandingFooter() {
  return (
    <>
      <section className={styles.finalCta} id="contact">
        <div>
          <h2>Put your AI workforce on a shorter leash.</h2>
          <p>Start with one high-risk workflow. Expand as your agent estate grows.</p>
        </div>
        <div>
          <a href="mailto:sales@sentinelops.ai" className={styles.primaryCta}>
            Book a demo <ArrowRight />
          </a>
          <Link href="/dashboard" className={styles.outlineCta}>
            Open control center <ArrowRight />
          </Link>
        </div>
      </section>
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <Brand footer />
          <p>Enterprise control for autonomous work.</p>
        </div>
        <div className={styles.footerLinks}>
          <div><strong>Product</strong><a href="#product">Overview</a><a href="#workflow">Workflow</a><a href="#security">Security</a></div>
          <div><strong>Company</strong><a href="mailto:sales@sentinelops.ai">Contact</a><Link href="/dashboard">Control center</Link></div>
        </div>
        <div className={styles.copyright}>© 2026 SentinelOps</div>
      </footer>
    </>
  );
}
