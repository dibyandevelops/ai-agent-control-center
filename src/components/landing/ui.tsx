export function SectionHeader({
  title,
  description,
  align = "left",
}: {
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  return (
    <header
      className={`max-w-[820px] ${align === "center" ? "mx-auto text-center" : ""}`}
    >
      <h2 className="m-0 text-[clamp(40px,4.1vw,66px)] font-black leading-[1.04] tracking-[-0.055em] max-[760px]:text-[clamp(36px,11vw,50px)]">
        {title}
      </h2>
      {description ? (
        <p className="mt-5 max-w-[680px] text-[clamp(15px,1.25vw,18px)] leading-[1.65] text-sentinel-muted max-[760px]:text-sm">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export function RiskBadge({
  level,
}: {
  level: "High" | "Medium" | "Low";
}) {
  return (
    <span
      className={`inline-flex w-max items-center justify-center rounded-full border px-2.5 py-1 font-mono text-[8px] font-semibold uppercase tracking-[0.06em] ${
        level === "High"
          ? "border-sentinel-red/50 bg-sentinel-red/10 text-sentinel-red"
          : level === "Medium"
            ? "border-sentinel-amber/50 bg-sentinel-amber/10 text-sentinel-amber"
            : "border-sentinel-lime/50 bg-sentinel-lime/10 text-sentinel-lime"
      }`}
    >
      {level} risk
    </span>
  );
}

export function TechnicalCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`rounded-3xl border border-sentinel-line-strong bg-sentinel-surface shadow-app-1 ${className}`}>{children}</div>;
}

export function DiagramNode({
  icon,
  label,
  detail,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  active?: boolean;
}) {
  return (
    <div className={`flex min-h-16 items-center gap-[11px] rounded-2xl border bg-sentinel-raised p-[10px_12px] transition hover:-translate-y-0.5 max-[760px]:grid max-[760px]:min-h-[95px] max-[760px]:justify-items-center max-[760px]:p-[9px] max-[760px]:text-center ${active ? "border-sentinel-lime" : "border-sentinel-line"}`}>
      <span className="grid h-[34px] w-[34px] place-items-center rounded-xl border border-sentinel-line text-sentinel-lime [&_svg]:w-[18px]">{icon}</span>
      <div className="grid gap-[3px]"><strong className="text-[10px] max-[760px]:text-[8px]">{label}</strong>{detail ? <small className="text-[8px] text-sentinel-muted">{detail}</small> : null}</div>
    </div>
  );
}
