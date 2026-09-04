"use client";

import { useEffect, useRef } from "react";
import type { DashboardView } from "@/lib/types";

interface UseKeyboardShortcutsOptions {
  onSelectView: (view: DashboardView) => void;
  onToggleShortcuts: () => void;
}

export function useKeyboardShortcuts({
  onSelectView,
  onToggleShortcuts,
}: UseKeyboardShortcutsOptions) {
  const pendingKeySeqRef = useRef<string | null>(null);
  const keySeqTimerRef = useRef<number | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onToggleShortcuts();
        return;
      }

      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) {
        pendingKeySeqRef.current = "g";
        if (keySeqTimerRef.current) window.clearTimeout(keySeqTimerRef.current);
        keySeqTimerRef.current = window.setTimeout(() => {
          pendingKeySeqRef.current = null;
        }, 1200);
        return;
      }

      if (pendingKeySeqRef.current === "g") {
        const key = e.key.toLowerCase();
        pendingKeySeqRef.current = null;
        if (key === "o") { e.preventDefault(); onSelectView("overview"); }
        else if (key === "a") { e.preventDefault(); onSelectView("agents"); }
        else if (key === "p") { e.preventDefault(); onSelectView("policies"); }
        else if (key === "i") { e.preventDefault(); onSelectView("integrations"); }
        else if (key === "u") { e.preventDefault(); onSelectView("audit"); }
        else if (key === "c") { e.preventDefault(); onSelectView("credentials"); }
        else if (key === "t") { e.preventDefault(); onSelectView("team"); }
        else if (key === "s") { e.preventDefault(); onSelectView("settings"); }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectView, onToggleShortcuts]);
}
