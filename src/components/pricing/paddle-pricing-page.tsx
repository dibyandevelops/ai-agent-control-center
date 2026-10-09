"use client";

import { Check, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { initializePaddle, type Environments, type Paddle } from "@paddle/paddle-js";
import { useCallback, useEffect, useState } from "react";
import type { Tier } from "@/lib/paddle-pricing";

type BillingInterval = "month" | "year";
const checkoutEnabled = process.env.NEXT_PUBLIC_PADDLE_CHECKOUT_ENABLED === "true";

let paddlePromise: Promise<Paddle | undefined> | null = null;
let initializedPaddleCustomerId: string | null | undefined;

function getConfiguredPaddle(paddleCustomerId: string | null, expectedEnvironment: string | undefined) {
  const environment = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT;
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;

  if (!environment) {
    throw new Error("NEXT_PUBLIC_PADDLE_ENVIRONMENT is required. Set it explicitly to sandbox or production.");
  }
  if (environment !== "sandbox" && environment !== "production") {
    throw new Error("NEXT_PUBLIC_PADDLE_ENVIRONMENT must be sandbox or production.");
  }
  if (expectedEnvironment !== environment) {
    throw new Error("Paddle server and browser environments do not match. Configure both for the same account.");
  }
  if (!token) {
    throw new Error("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is required. Create a client-side token in Paddle Authentication.");
  }
  if (environment === "sandbox" && !token.startsWith("test_")) {
    throw new Error("Sandbox requires a Paddle client-side token prefixed with test_.");
  }
  if (environment === "production" && !token.startsWith("live_")) {
    throw new Error("Production requires a Paddle client-side token prefixed with live_.");
  }

  if (!paddlePromise) {
    const initialCustomerId = paddleCustomerId;
    paddlePromise = initializePaddle({
      environment: environment as Environments,
      token,
      pwCustomer: initialCustomerId ? { id: initialCustomerId } : {},
    }).then((paddle) => {
      initializedPaddleCustomerId = initialCustomerId;
      return paddle;
    });
  }
  return paddlePromise.then((paddle) => {
    if (paddle && initializedPaddleCustomerId !== paddleCustomerId) {
      paddle.Update({ pwCustomer: paddleCustomerId ? { id: paddleCustomerId } : {} });
      initializedPaddleCustomerId = paddleCustomerId;
    }
    return paddle;
  });
}

export function PaddlePricingPage({
  countryCode,
  tiers,
  expectedEnvironment,
  configurationError,
}: {
  countryCode?: string;
  tiers: Tier[];
  expectedEnvironment?: string;
  configurationError?: string;
}) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");
  const [paddle, setPaddle] = useState<Paddle>();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [customerEmail, setCustomerEmail] = useState("");
  const [paddleCustomerId, setPaddleCustomerId] = useState<string | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openingPriceId, setOpeningPriceId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void fetch("/api/v1/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{
          authenticated?: boolean;
          operator?: { email?: string } | null;
          paddleCustomerId?: string | null;
        }>;
      })
      .then((session) => {
        if (active && session?.authenticated && session.operator?.email) {
          setCustomerEmail(session.operator.email);
        }
        if (active) {
          setPaddleCustomerId(session?.authenticated ? session.paddleCustomerId ?? null : null);
          setSessionLoaded(true);
        }
      })
      .catch(() => {
        if (active) setSessionLoaded(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPrices() {
      if (!sessionLoaded) return;
      setLoading(true);
      setError(null);
      try {
        if (configurationError) throw new Error(configurationError);
        if (tiers.some((tier) => !tier.priceId.month || !tier.priceId.year)) {
          throw new Error("Paddle price IDs are not configured for every plan and billing interval.");
        }
        const configuredPaddle = await getConfiguredPaddle(paddleCustomerId, expectedEnvironment);
        if (!configuredPaddle) throw new Error("Paddle.js could not be initialized.");
        if (!active) return;
        setPaddle(configuredPaddle);

        const items = tiers.flatMap((tier) => [
          { priceId: tier.priceId.month, quantity: 1 },
          { priceId: tier.priceId.year, quantity: 1 },
        ]);
        const preview = await configuredPaddle.PricePreview({
          items,
          ...(countryCode ? { address: { countryCode } } : {}),
        });

        const nextPrices: Record<string, string> = {};
        for (const lineItem of preview.data.details.lineItems) {
          nextPrices[lineItem.price.id] = lineItem.formattedTotals.total;
        }
        const missingPrice = items.find((item) => !nextPrices[item.priceId]);
        if (missingPrice) {
          throw new Error(`Paddle did not return a formatted total for price ${missingPrice.priceId}.`);
        }
        if (active) setPrices(nextPrices);
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : "Paddle pricing could not be loaded.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPrices();
    return () => {
      active = false;
    };
  }, [configurationError, countryCode, expectedEnvironment, paddleCustomerId, sessionLoaded, tiers]);

  const openCheckout = useCallback(async (priceId: string) => {
    if (!checkoutEnabled || !paddle) return;
    setOpeningPriceId(priceId);
    setError(null);
    try {
      const customer = customerEmail
        ? {
            email: customerEmail,
            ...(countryCode ? { address: { countryCode } } : {}),
          }
        : undefined;
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        ...(customer ? { customer } : {}),
        settings: {
          displayMode: "overlay",
          variant: "one-page",
          successUrl: new URL("/welcome", window.location.origin).toString(),
        },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Paddle Checkout could not be opened.");
    } finally {
      setOpeningPriceId(null);
    }
  }, [countryCode, customerEmail, paddle]);

  return (
    <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24">
      <header className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-sentinel-line bg-sentinel-surface px-3 py-1 text-xs font-semibold text-sentinel-muted">
          <Sparkles className="h-3.5 w-3.5 text-sentinel-lime" />
          Plans for safer AI operations
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-sentinel-text sm:text-6xl">
          Clear pricing. <span className="text-sentinel-lime">Stronger guardrails.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-sentinel-muted sm:text-lg">
          Start with the controls you need today, then scale governance as your agents take on more consequential work.
        </p>

        <div className="mt-8 inline-flex rounded-2xl border border-sentinel-line bg-sentinel-surface p-1.5" role="group" aria-label="Billing interval">
          {(["month", "year"] as const).map((interval) => (
            <button
              key={interval}
              type="button"
              aria-pressed={billingInterval === interval}
              onClick={() => setBillingInterval(interval)}
              className={`rounded-xl px-5 py-2.5 text-sm font-bold transition ${billingInterval === interval ? "bg-sentinel-lime text-sentinel-canvas" : "text-sentinel-muted hover:text-sentinel-text"}`}
            >
              {interval === "month" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-sentinel-muted">Every plan includes a 7-day free trial.</p>
      </header>

      {error && (
        <div role="alert" className="mx-auto mt-8 max-w-3xl rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm text-rose-700 dark:text-rose-200">
          Paddle setup needs attention: {error}
        </div>
      )}

      <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3">
        {tiers.map((tier) => {
          const priceId = tier.priceId[billingInterval];
          const formattedTotal = prices[priceId];
          const isOpening = openingPriceId === priceId;

          return (
            <article
              key={tier.name}
              className={`relative flex flex-col rounded-3xl border p-7 shadow-sm sm:p-8 ${tier.featured ? "border-sentinel-lime bg-sentinel-surface shadow-xl shadow-sentinel-lime/10 lg:-translate-y-2" : "border-sentinel-line bg-sentinel-surface/80"}`}
            >
              {tier.featured && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sentinel-lime px-3 py-1 text-[10px] font-black uppercase tracking-wider text-sentinel-canvas">Most popular</span>}
              <h2 className="text-2xl font-black text-sentinel-text">{tier.name}</h2>
              <p className="mt-2 min-h-12 text-sm leading-6 text-sentinel-muted">{tier.description}</p>
              <div className="mt-6 min-h-16">
                <p className="text-4xl font-black tracking-tight text-sentinel-text" aria-live="polite">
                  {loading ? <span className="inline-block h-10 w-32 animate-pulse rounded-lg bg-sentinel-line align-middle" aria-label="Loading price" /> : formattedTotal ?? "—"}
                </p>
                <p className="mt-1 text-xs text-sentinel-muted">{billingInterval === "month" ? "per month" : "per year, billed annually"}</p>
              </div>

              <button
                type="button"
                disabled={!checkoutEnabled || !paddle || !formattedTotal || Boolean(error) || isOpening}
                onClick={() => void openCheckout(priceId)}
                className={`mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${tier.featured ? "bg-sentinel-lime text-sentinel-canvas hover:brightness-110" : "border border-sentinel-line-strong bg-sentinel-canvas text-sentinel-text hover:border-sentinel-lime"}`}
              >
                {isOpening ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {isOpening ? "Opening checkout…" : checkoutEnabled ? "Subscribe" : "Available after approval"}
              </button>

              <div className="mt-7 border-t border-sentinel-line pt-6">
                <p className="text-xs font-bold uppercase tracking-wide text-sentinel-muted">What&apos;s included</p>
                <ul className="mt-4 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-3 text-sm leading-5 text-sentinel-text">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-sentinel-lime" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mx-auto mt-8 flex max-w-3xl items-center justify-center gap-2 text-center text-xs leading-5 text-sentinel-muted">
        <ShieldCheck className="h-4 w-4 shrink-0 text-sentinel-lime" />
        {checkoutEnabled
          ? "Secure checkout and local currency pricing are provided by Paddle."
          : "Prices are provided by Paddle. Checkout will open after seller verification and domain approval."}
      </p>
    </section>
  );
}
