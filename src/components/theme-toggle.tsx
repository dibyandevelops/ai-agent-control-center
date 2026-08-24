"use client";

import { Moon, Sun } from "lucide-react";
import React from "react";
import { useTheme } from "./theme-provider";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-sentinel-line bg-sentinel-surface text-sentinel-muted transition-colors hover:border-sentinel-lime/50 hover:bg-sentinel-raised hover:text-sentinel-text ${className ?? ""}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform duration-200 hover:rotate-45" />
      ) : (
        <Moon className="h-4 w-4 text-indigo-500 transition-transform duration-200 hover:-rotate-12" />
      )}
    </button>
  );
}
