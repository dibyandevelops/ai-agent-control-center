import { describe, expect, it, vi } from "vitest";
import {
  notificationOutboxEndpoint,
  triggerNotificationOutbox,
} from "./notification-dispatch-core";

describe("near-real-time notification dispatch", () => {
  it("prefers the configured public URL and normalizes trailing slashes", () => {
    expect(
      notificationOutboxEndpoint({
        publicUrl: "https://sentinelops.example/",
        vercelProductionUrl: "ignored.vercel.app",
      }),
    ).toBe("https://sentinelops.example/api/v1/internal/notification-outbox");
  });

  it("falls back to the Vercel production hostname", () => {
    expect(
      notificationOutboxEndpoint({
        vercelProductionUrl: "sentinelops.vercel.app",
      }),
    ).toBe("https://sentinelops.vercel.app/api/v1/internal/notification-outbox");
  });

  it("returns null when no deployment URL is available", () => {
    expect(notificationOutboxEndpoint({})).toBeNull();
  });

  it("authenticates and triggers the durable worker", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    await expect(
      triggerNotificationOutbox({
        endpoint: "https://sentinelops.example/api/v1/internal/notification-outbox",
        cronSecret: "a".repeat(64),
        fetcher: fetcher as typeof fetch,
      }),
    ).resolves.toEqual({ delivered: true, status: 200 });
    expect(fetcher).toHaveBeenCalledWith(
      "https://sentinelops.example/api/v1/internal/notification-outbox",
      expect.objectContaining({
        method: "POST",
        headers: { authorization: `Bearer ${"a".repeat(64)}` },
        cache: "no-store",
      }),
    );
  });
});
