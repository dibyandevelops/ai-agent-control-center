import Link from "next/link";
import { SentinelLogo } from "@/components/brand-logo";

interface BrandProps {
  footer?: boolean;
}

export function Brand({ footer = false }: BrandProps) {
  return (
    <Link
      href="/"
      className={`inline-flex w-max items-center gap-3 font-black tracking-tight text-sentinel-text no-underline font-sentinel transition hover:opacity-90 ${
        footer ? "text-2xl" : "text-lg"
      }`}
      aria-label="SentinelOps home"
    >
      <SentinelLogo size={footer ? 36 : 28} />
      <span>
        Sentinel<span className="text-emerald-600 dark:text-sentinel-lime">Ops</span>
      </span>
    </Link>
  );
}

