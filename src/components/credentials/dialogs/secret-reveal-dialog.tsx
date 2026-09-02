"use client";

import { Check, Copy, LoaderCircle, ShieldCheck, Wifi } from "lucide-react";
import React, { useState } from "react";
import type { AgentApiKey } from "@/lib/types";
import { DialogShell } from "./dialog-shell";

export function SecretRevealDialog({
  title,
  description,
  secret,
  apiKey,
  onClose,
  onTested,
}: {
  title: string;
  description: string;
  secret: string;
  apiKey: AgentApiKey;
  onClose: () => void;
  onTested: (apiKeyId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [testState, setTestState] = useState<
    "idle" | "testing" | "verified" | "failed"
  >("idle");
  const [testMessage, setTestMessage] = useState("");

  async function copySecret() {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setError("Copy failed. Select the API key manually.");
    }
  }

  async function testConnection() {
    setTestState("testing");
    setTestMessage("");
    try {
      const response = await fetch("/api/v1/actions/evaluate", {
        method: "POST",
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          idempotencyKey: `onboarding-${apiKey.id}-${crypto.randomUUID()}`,
          agent: {
            externalId: `onboarding-${apiKey.id}`,
            name: `${apiKey.name} connection check`,
            ownerEmail: "platform@example.com",
            team: "Platform Engineering",
            provider: "SentinelOps quickstart",
          },
          action: "system.health.read",
          resource: "sentinelops://credential-test",
          environment: "development",
          riskHint: "low",
          context: { onboardingTest: true },
        }),
      });
      const payload = (await response.json()) as {
        status?: string;
        requestId?: string;
        error?: string;
      };
      if (!response.ok || !payload.status || !payload.requestId) {
        throw new Error(payload.error || "Credential test failed.");
      }
      setTestState("verified");
      setTestMessage(`Connected. SentinelOps returned ${payload.status}.`);
      onTested(apiKey.id);
    } catch (testError) {
      setTestState("failed");
      setTestMessage(
        testError instanceof Error ? testError.message : "Credential test failed.",
      );
    }
  }

  return (
    <DialogShell title={title} description={description} onClose={onClose}>
      <div className="space-y-5">
        <div className="flex items-start gap-2.5 rounded-xl border border-sentinel-lime/25 bg-sentinel-lime/10 px-3.5 py-3 text-xs leading-5 text-sentinel-text">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-lime" />
          Save this key now. SentinelOps stores only its SHA-256 hash and cannot show it again.
        </div>
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sentinel-dim">
            Agent API key · shown once
          </span>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-sentinel-line-strong bg-sentinel-canvas p-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-2 font-mono text-xs text-sentinel-text">
              {secret}
            </code>
            <button
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-sentinel-line text-sentinel-muted transition hover:text-sentinel-text"
              onClick={() => void copySecret()}
              aria-label={copied ? "API key copied" : "Copy API key"}
            >
              {copied ? (
                <Check className="h-4 w-4 text-sentinel-lime" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
        <div
          className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 ${
            testState === "verified"
              ? "border-sentinel-lime/25 bg-sentinel-lime/10"
              : testState === "failed"
                ? "border-sentinel-red/30 bg-sentinel-red/10"
                : "border-sentinel-line bg-sentinel-raised/50"
          }`}
        >
          <Wifi
            className={`mt-0.5 h-4 w-4 shrink-0 ${
              testState === "verified"
                ? "text-sentinel-lime"
                : testState === "failed"
                  ? "text-red-600 dark:text-red-300"
                  : "text-sentinel-muted"
            }`}
          />
          <div className="min-w-0 flex-1">
            <strong className="block text-xs font-semibold text-sentinel-text">
              Verify before installing
            </strong>
            <p className="mt-1 text-[11px] leading-5 text-sentinel-muted">
              {testMessage ||
                "Send a harmless development health-read through the real policy engine."}
            </p>
          </div>
          {testState !== "verified" ? (
            <button
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-sentinel-line px-2.5 text-[11px] font-semibold text-sentinel-text transition hover:border-sentinel-lime/40 disabled:cursor-wait"
              onClick={() => void testConnection()}
              disabled={testState === "testing"}
            >
              {testState === "testing" ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wifi className="h-3.5 w-3.5" />
              )}
              {testState === "testing" ? "Testing…" : "Test connection"}
            </button>
          ) : (
            <Check className="h-4 w-4 shrink-0 text-sentinel-lime" />
          )}
        </div>
        {error ? (
          <div className="rounded-xl border border-sentinel-red/30 bg-sentinel-red/10 px-3.5 py-3 text-xs text-red-700 dark:text-red-200">
            {error}
          </div>
        ) : null}
        <div className="flex justify-end border-t border-sentinel-line pt-5">
          <button className="primary-button" onClick={onClose}>
            I saved this key
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
