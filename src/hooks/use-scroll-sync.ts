"use client";

import { useCallback, useRef } from "react";

export function useScrollSync() {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const handlePinnedWheel = useCallback((e: React.WheelEvent) => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop += e.deltaY;
    }
  }, []);

  const scrollToTop = useCallback(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  return {
    scrollAreaRef,
    handlePinnedWheel,
    scrollToTop,
  };
}
