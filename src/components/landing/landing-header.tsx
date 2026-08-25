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

  return (
    <header
      className={`fixed inset-x-[max(18px,calc((100vw-1480px)/2))] top-3.5 z-[100] grid min-h-[68px] grid-cols-[1fr_auto_1fr] items-center rounded-2xl border px-[14px] pl-[18px] transition-all duration-300 max-lg:grid-cols-[1fr_auto] max-[760px]:inset-x-3.5 max-[760px]:top-3 max-[760px]:min-h-[62px] max-[760px]:border-sentinel-line-strong/50 max-[760px]:bg-sentinel-canvas/90 max-[760px]:pl-3.5 max-[760px]:backdrop-blur-xl ${
        scrolled
          ? "min-h-[58px] border-sentinel-line-strong/60 bg-sentinel-canvas/80 shadow-[0_18px_50px_rgba(0,0,0,0.3)] backdrop-blur-xl"
          : "border-transparent"
      }`}
    >
      <Brand />
      <nav className="flex items-center gap-[34px] text-[13px] font-medium text-sentinel-muted max-lg:hidden [&_a]:transition-colors [&_a:hover]:text-sentinel-lime" aria-label="Marketing navigation">
        {navItems.map((item) => (
          <a href={item.href} key={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="flex items-center justify-end gap-[18px] text-[13px] font-semibold max-lg:hidden">
        <ThemeToggle />
        <Link href="/dashboard" className="text-sentinel-text transition-colors hover:text-sentinel-lime">
          Sign in
        </Link>
        <Link href="/get-started" className="inline-flex min-h-[42px] items-center justify-center rounded-full border border-sentinel-lime/70 bg-sentinel-lime/[0.06] px-[22px] font-semibold text-sentinel-text transition hover:-translate-y-px hover:bg-sentinel-lime hover:text-sentinel-canvas">Create workspace</Link>
      </div>
      <button
        type="button"
        className="hidden h-[42px] w-[42px] place-items-center rounded-full border border-sentinel-line bg-sentinel-surface text-sentinel-text max-lg:grid [&_svg]:w-5"
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((current) => !current)}
      >
        {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
      </button>
      <div
        className={`absolute inset-x-0 top-[calc(100%+8px)] hidden rounded-2xl border border-sentinel-line bg-sentinel-surface/[0.98] p-3.5 shadow-app-2 backdrop-blur-xl transition-[opacity,transform,visibility] duration-150 max-lg:block ${
          menuOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"
        }`}
      >
        <nav className="grid [&_a]:border-b [&_a]:border-sentinel-line [&_a]:px-3 [&_a]:py-[15px] [&_a]:text-sm [&_a:last-child]:border-0 [&_a:last-child]:text-sentinel-lime" aria-label="Mobile marketing navigation">
          {navItems.map((item) => (
            <a
              href={item.href}
              key={item.href}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
            Open control center
          </Link>
          <Link href="/get-started" onClick={() => setMenuOpen(false)}>Create workspace</Link>
        </nav>
      </div>
    </header>
  );
}
