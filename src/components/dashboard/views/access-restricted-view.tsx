"use client";

import { KeyRound, Lock, LogIn, ShieldAlert, UsersRound } from "lucide-react";
import React from "react";
import type { DashboardView } from "@/lib/types";

export function AccessRestrictedView({
  targetView,
  onConnect,
  onBackToOverview,
}: {
  targetView: "credentials" | "team";
  onConnect: () => void;
  onBackToOverview: () => void;
}) {
  const isCredentials = targetView === "credentials";

  return (
    <main className="page flex min-h-[70vh] items-center justify-center p-6">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-sentinel-line bg-gradient-to-b from-sentinel-surface to-sentinel-canvas p-8 text-center shadow-2xl backdrop-blur-xl">
        {/* Glow ambient circle */}
        <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-sentinel-lime/10 blur-3xl" />

        <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-sentinel-line-strong bg-sentinel-surface-raised shadow-inner">
          {isCredentials ? (
            <KeyRound className="h-8 w-8 text-sentinel-lime" />
          ) : (
            <UsersRound className="h-8 w-8 text-sentinel-lime" />
          )}
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-sentinel-amber/30 bg-sentinel-amber/10 px-3 py-1 text-xs font-semibold text-sentinel-amber">
          <Lock className="h-3.5 w-3.5" />
          <span>Administrator Access Required</span>
        </div>

        <h2 className="mt-4 text-xl font-bold tracking-tight text-sentinel-text sm:text-2xl">
          {isCredentials
            ? "Agent Credentials & API Key Vault"
            : "Team Operator & Role Directory"}
        </h2>

        <p className="mt-3 text-xs leading-relaxed text-sentinel-muted sm:text-sm">
          {isCredentials
            ? "Minting runtime API credentials, inspecting cryptographic token hashes, and triggering automated key rotations require an authenticated administrator session."
            : "Inviting team operators, modifying RBAC policy scopes, SAML/SCIM identity provisioning, and sign-off delegations are restricted to organization administrators."}
        </p>

        <div className="mt-6 rounded-2xl border border-sentinel-line bg-sentinel-canvas/60 p-4 text-left">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-muted" />
            <div className="text-xs text-sentinel-muted">
              <strong className="block text-sentinel-text">Zero-Trust Isolation</strong>
              In preview mode, demo data is read-only for security reasons. Connect your production or staging database session to unlock full access.
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            className="secondary-button"
            onClick={onBackToOverview}
          >
            Return to Overview
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onConnect}
          >
            <LogIn className="h-4 w-4" /> Sign In / Connect Live
          </button>
        </div>
      </div>
    </main>
  );
}
