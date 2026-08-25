"use client";

import React from "react";

interface BrandLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function SentinelLogo({ className = "", size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 44 48"
      width={size}
      height={(size * 48) / 44}
      aria-hidden="true"
      className={`shrink-0 drop-shadow-[0_0_12px_rgba(183,243,74,0.25)] ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="sentinel-s-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b7f34a" />
          <stop offset="60%" stopColor="#2dd4bf" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="sentinel-hex-stroke" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b7f34a" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* Hexagonal Outer Frame */}
      <path
        d="M22 2.5 L41.5 12.5 V35.5 L22 45.5 L2.5 35.5 V12.5 Z"
        stroke="url(#sentinel-hex-stroke)"
        strokeWidth="3.2"
        strokeLinejoin="round"
        className="text-emerald-500 dark:text-sentinel-lime"
      />

      {/* Isometric Ribbon "S" */}
      <path
        d="M12 17 L22 11 L32 17 L22 23 L32 29 L22 36 L12 30 L17 27 L22 30 L26 28 L12 20 V17 Z"
        fill="url(#sentinel-s-gradient)"
        className="text-emerald-600 dark:text-sentinel-lime"
      />
    </svg>
  );
}

export function BrandLogo({ className = "", size = 28, showText = true }: BrandLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <SentinelLogo size={size} />
      {showText && (
        <span className="text-base font-black tracking-tight text-sentinel-text font-sentinel">
          Sentinel<span className="text-emerald-600 dark:text-sentinel-lime">Ops</span>
        </span>
      )}
    </div>
  );
}
