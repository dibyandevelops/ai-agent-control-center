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
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sentinel-logo-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06090e" />
          <stop offset="100%" stopColor="#0f1722" />
        </linearGradient>
        <linearGradient id="sentinel-logo-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#b7f34a" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>

      {/* Hexagonal Shield Container */}
      <rect width="32" height="32" rx="8" fill="url(#sentinel-logo-bg)" stroke="#23354a" strokeWidth="1" />

      {/* Zero-Trust Shield Boundary */}
      <path
        d="M16 5.5 L24 9.5 V15.5 C24 20.8 20.5 25.2 16 26.5 C11.5 25.2 8 20.8 8 15.5 V9.5 Z"
        fill="none"
        stroke="url(#sentinel-logo-glow)"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />

      {/* Quantum Prism Core */}
      <circle cx="16" cy="15" r="2.5" fill="#b7f34a" />

      {/* Quorum Gate Arcs */}
      <path d="M16 11.5 V12.5 M16 17.5 V18.5 M12.5 15 H13.5 M18.5 15 H19.5" stroke="#38bdf8" strokeWidth="1.2" strokeLinecap="round" />
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
