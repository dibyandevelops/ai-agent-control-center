import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import styles from "./landing.module.css";

interface BrandProps {
  footer?: boolean;
}

export function Brand({ footer = false }: BrandProps) {
  return (
    <Link
      href="/"
      className={`${styles.brand} ${footer ? styles.brandFooter : ""}`}
      aria-label="SentinelOps home"
    >
      <span className={styles.brandIcon}>
        <ShieldCheck aria-hidden="true" />
      </span>
      <span>
        Sentinel<strong>Ops</strong>
      </span>
    </Link>
  );
}
