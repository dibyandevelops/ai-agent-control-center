"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Brand } from "./brand";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { label: "Product", href: "#product" },
  { label: "Live Sandbox", href: "#sandbox" },
  { label: "Workflow", href: "#workflow" },
  { label: "Security", href: "#security" },
  { label: "Pricing", href: "#pricing" },
  { label: "Deployments", href: "#deployments" },
] as const;

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, []);

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <header
        className={`fixed inset-x-[max(18px,calc((100vw-1480px)/2))] top-3.5 z-[100] grid min-h-[68px] grid-cols-[1fr_auto_1fr] items-center rounded-2xl border px-[14px] pl-[18px] transition-all duration-300 max-lg:grid-cols-[1fr_auto] max-[760px]:inset-x-3.5 max-[760px]:top-3 max-[760px]:min-h-[58px] max-[760px]:border-sentinel-line max-[760px]:bg-sentinel-surface max-[760px]:pl-3.5 max-[760px]:shadow-lg ${
          scrolled
            ? "min-h-[58px] border-sentinel-line bg-sentinel-surface shadow-[0_18px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl"
            : "border-transparent bg-sentinel-surface/80 max-[760px]:border-sentinel-line"
        }`}
      >
        <Brand />
        <nav
          className="flex items-center gap-[34px] text-[13px] font-medium text-sentinel-muted max-lg:hidden [&_a]:transition-colors [&_a:hover]:text-sentinel-lime"
          aria-label="Marketing navigation"
        >
          {navItems.map((item) => (
            <a href={item.href} key={item.href}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center justify-end gap-[18px] text-[13px] font-semibold max-lg:hidden">
          <ThemeToggle />
          <Link
            href="/dashboard"
            className="text-sentinel-text transition-colors hover:text-sentinel-lime"
          >
            Sign in
          </Link>
          <Link
            href="/get-started"
            className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-sentinel-lime/70 bg-sentinel-lime/[0.06] px-[22px] font-semibold text-sentinel-text transition hover:-translate-y-px hover:bg-sentinel-lime hover:text-sentinel-canvas"
          >
            Create workspace
          </Link>
        </div>
        <button
          type="button"
          className="hidden h-[40px] w-[40px] place-items-center rounded-full border border-sentinel-line bg-sentinel-surface text-sentinel-text max-lg:grid [&_svg]:w-5 transition hover:bg-sentinel-raised"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        {/* Mobile Dropdown Navigation Menu */}
        <div
          className={`absolute inset-x-0 top-[calc(100%+8px)] hidden rounded-2xl border border-sentinel-line bg-sentinel-surface p-4 shadow-2xl transition-all duration-200 max-lg:block ${
            menuOpen
              ? "visible translate-y-0 opacity-100"
              : "invisible -translate-y-2 opacity-0 pointer-events-none"
          }`}
        >
          <nav
            className="grid [&_a]:border-b [&_a]:border-sentinel-line [&_a]:px-3 [&_a]:py-[12px] [&_a]:text-sm [&_a]:font-medium [&_a]:text-sentinel-text [&_a:hover]:text-sentinel-lime"
            aria-label="Mobile marketing navigation"
          >
            {navItems.map((item) => (
              <a
                href={item.href}
                key={item.href}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="mt-3 pt-3 border-t border-sentinel-line flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-xs text-sentinel-muted font-medium">Appearance</span>
              <ThemeToggle />
            </div>
            <Link
              href="/dashboard"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center h-10 rounded-xl border border-sentinel-line bg-sentinel-raised font-semibold text-xs text-sentinel-text hover:text-sentinel-lime transition"
            >
              Sign in to Control Center
            </Link>
            <Link
              href="/get-started"
              onClick={() => setMenuOpen(false)}
              className="flex items-center justify-center h-11 rounded-xl bg-sentinel-lime text-sentinel-canvas font-bold text-xs shadow-lg hover:brightness-105 transition"
            >
              Create workspace →
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
