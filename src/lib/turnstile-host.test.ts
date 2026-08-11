import { describe, expect, it } from "vitest";
import { isLoopbackHostname, shouldBypassTurnstile } from "./turnstile-host";

describe("Turnstile localhost bypass", () => {
  it.each(["localhost", "app.localhost", "127.0.0.1", "::1", "[::1]"])(
    "recognizes %s as a loopback hostname",
    (hostname) => {
      expect(isLoopbackHostname(hostname)).toBe(true);
    },
  );

  it.each(["sentinelops-staging.vercel.app", "sentinelops.example.com", "localhost.example.com"])(
    "does not treat %s as a loopback hostname",
    (hostname) => {
      expect(isLoopbackHostname(hostname)).toBe(false);
    },
  );

  it("bypasses Turnstile on localhost during development", () => {
    expect(shouldBypassTurnstile("localhost", "development")).toBe(true);
  });

  it("keeps Turnstile enabled for production, including a production server on localhost", () => {
    expect(shouldBypassTurnstile("localhost", "production")).toBe(false);
  });

  it("keeps Turnstile enabled for staging and production hostnames", () => {
    expect(shouldBypassTurnstile("sentinelops-staging.vercel.app", "development")).toBe(false);
    expect(shouldBypassTurnstile("sentinelops.example.com", "production")).toBe(false);
  });
});
