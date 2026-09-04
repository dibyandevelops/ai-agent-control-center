"use client";

import { KeyRound, X } from "lucide-react";
import React from "react";

export function DialogShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 max-sm:items-end max-sm:p-0 bg-black/75 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-app-lg max-sm:rounded-b-none max-sm:max-h-[90dvh] max-sm:overflow-y-auto border border-sentinel-line-strong bg-sentinel-surface shadow-app-2 pb-safe"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-key-dialog-title"
      >
        <div className="flex items-start justify-between border-b border-sentinel-line px-6 py-5">
          <div className="flex min-w-0 gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sentinel-lime/25 bg-sentinel-lime/10 text-sentinel-lime">
              <KeyRound className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2
                id="api-key-dialog-title"
                className="text-lg font-semibold tracking-tight text-sentinel-text"
              >
                {title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-sentinel-muted">
                {description}
              </p>
            </div>
          </div>
          <button
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
