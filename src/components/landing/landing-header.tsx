import Link from "next/link";
import { Menu } from "lucide-react";
import { Brand } from "./brand";
import styles from "./landing.module.css";

export function LandingHeader() {
  return (
    <header className={styles.header}>
      <Brand />
      <nav className={styles.desktopNav} aria-label="Marketing navigation">
        <a href="#product">Product</a>
        <a href="#workflow">Workflow</a>
        <a href="#security">Security</a>
      </nav>
      <div className={styles.headerActions}>
        <Link href="/dashboard" className={styles.signIn}>
          Sign in
        </Link>
        <a href="#contact" className={styles.headerCta}>
          Book a demo
        </a>
      </div>
      <details className={styles.mobileMenu}>
        <summary aria-label="Open navigation">
          <Menu aria-hidden="true" />
        </summary>
        <nav aria-label="Mobile marketing navigation">
          <a href="#product">Product</a>
          <a href="#workflow">Workflow</a>
          <a href="#security">Security</a>
          <Link href="/dashboard">Open control center</Link>
          <a href="#contact">Book a demo</a>
        </nav>
      </details>
    </header>
  );
}
