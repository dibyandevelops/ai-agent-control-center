"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Info,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastData {
  id?: string;
  message: string;
  type?: ToastType;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ToastNotificationProps {
  toast: ToastData | string | null;
  onClose: () => void;
}

export function ToastNotification({ toast, onClose }: ToastNotificationProps) {
  const toastData = useMemo<ToastData | null>(() => {
    if (!toast) return null;
    return typeof toast === "string" ? { message: toast, type: "success" } : toast;
  }, [toast]);

  if (!toastData) return null;

  const key = toastData.id || toastData.message;
  return <ToastCard key={key} toastData={toastData} onClose={onClose} />;
}

function ToastCard({ toastData, onClose }: { toastData: ToastData; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(100);

  const duration = toastData.durationMs ?? 4200;
  const elapsedRef = useRef(0);

  useEffect(() => {
    if (paused) return;

    const intervalTime = 50;
    const timer = setInterval(() => {
      elapsedRef.current += intervalTime;
      const remainingPct = Math.max(0, 100 - (elapsedRef.current / duration) * 100);
      setProgress(remainingPct);

      if (remainingPct <= 0) {
        clearInterval(timer);
        onClose();
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [paused, duration, onClose]);

  const type = toastData.type || "success";

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-sentinel-success shrink-0" />,
    error: <ShieldAlert className="h-4 w-4 text-sentinel-danger shrink-0" />,
    warning: <AlertTriangle className="h-4 w-4 text-sentinel-amber shrink-0" />,
    info: <Info className="h-4 w-4 text-sentinel-accent shrink-0" />,
  };

  const borderColors = {
    success: "border-sentinel-border",
    error: "border-sentinel-danger/40",
    warning: "border-sentinel-amber/40",
    info: "border-sentinel-accent/40",
  };

  return (
    <div
      className={`fixed bottom-5 right-5 z-[200] flex max-w-md min-w-[320px] flex-col overflow-hidden rounded-2xl border bg-sentinel-surface text-sentinel-text shadow-2xl animate-toast-in backdrop-blur-md ${borderColors[type]}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      role="status"
    >
      <div className="flex items-center justify-between gap-3 p-3.5">
        <div className="flex items-center gap-2.5 min-w-0">
          {icons[type]}
          <span className="text-xs font-semibold text-sentinel-text leading-tight">
            {toastData.message}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {toastData.actionLabel && toastData.onAction ? (
            <button
              type="button"
              onClick={() => {
                toastData.onAction?.();
                onClose();
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-sentinel-border bg-sentinel-surface-raised px-2.5 py-1 text-[11px] font-bold text-sentinel-accent transition hover:border-sentinel-accent hover:bg-sentinel-accent-soft"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{toastData.actionLabel}</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded text-sentinel-muted hover:bg-sentinel-surface-raised hover:text-sentinel-text transition"
            aria-label="Dismiss notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 w-full bg-sentinel-surface-raised/60">
        <div
          className={`h-full transition-all duration-75 ease-linear ${
            type === "error"
              ? "bg-sentinel-danger"
              : type === "warning"
                ? "bg-sentinel-amber"
                : "bg-sentinel-accent"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
