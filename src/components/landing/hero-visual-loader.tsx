"use client";

import dynamic from "next/dynamic";

const ControlPlaneScene = dynamic(
  () => import("./control-plane-scene").then((module) => module.ControlPlaneScene),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-[650px] place-items-center content-center rounded-[10px] border border-sentinel-line bg-sentinel-surface text-sentinel-lime">
        <span className="text-2xl font-bold">SentinelOps</span>
        <small className="mt-[7px] text-sentinel-muted">Enforcement gateway</small>
      </div>
    ),
  },
);

export function HeroVisualLoader() {
  return <ControlPlaneScene />;
}
