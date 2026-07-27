import Link from "next/link";

interface BrandProps {
  footer?: boolean;
}

function BrandMark() {
  return (
    <svg
      viewBox="0 0 44 48"
      aria-hidden="true"
      className="h-[31px] w-7 text-sentinel-lime drop-shadow-[0_0_10px_rgba(183,243,74,0.13)]"
      fill="none"
    >
      <path d="M22 2 40 12v24L22 46 4 36V12L22 2Z" stroke="currentColor" strokeWidth="4" />
      <path d="m12 17 10-6 10 6-10 6 10 6-10 7-10-6 5-3 5 3 4-2-14-8v-3Z" fill="currentColor" />
    </svg>
  );
}

export function Brand({ footer = false }: BrandProps) {
  return (
    <Link
      href="/"
      className={`inline-flex w-max items-center gap-[11px] font-semibold tracking-[-0.035em] text-sentinel-text no-underline ${
        footer ? "text-[25px] [&_svg]:!h-11 [&_svg]:!w-10" : "text-lg"
      }`}
      aria-label="SentinelOps home"
    >
      <BrandMark />
      <span>SentinelOps</span>
    </Link>
  );
}
