import { describe, expect, it } from "vitest";
import {
  assertPublicHttpsWebhookUrl,
  isPrivateOrReservedIp,
  signHttpsWebhookBody,
  verifyHttpsWebhookSignature,
} from "./https-webhook-core";

describe("HTTPS webhook signing", () => {
  it("round-trips a timestamped HMAC signature", () => {
    const timestamp = "1710000000";
    const body = '{"type":"action.approval_requested"}';
    const signature = signHttpsWebhookBody({
      secret: "swhsec_test_secret",
      timestamp,
      body,
    });

    expect(signature.startsWith("v1=")).toBe(true);
    expect(
      verifyHttpsWebhookSignature({
        secret: "swhsec_test_secret",
        timestamp,
        body,
        signature,
        nowSeconds: 1710000000,
      }),
    ).toBe(true);
  });

  it("rejects stale or tampered signatures", () => {
    const timestamp = "1710000000";
    const body = '{"ok":true}';
    const signature = signHttpsWebhookBody({
      secret: "swhsec_test_secret",
      timestamp,
      body,
    });

    expect(
      verifyHttpsWebhookSignature({
        secret: "swhsec_test_secret",
        timestamp,
        body: '{"ok":false}',
        signature,
        nowSeconds: 1710000000,
      }),
    ).toBe(false);
    expect(
      verifyHttpsWebhookSignature({
        secret: "swhsec_test_secret",
        timestamp,
        body,
        signature,
        nowSeconds: 1710000000 + 6 * 60,
      }),
    ).toBe(false);
  });
});

describe("HTTPS webhook SSRF guards", () => {
  it("flags loopback, RFC1918, link-local, and unique-local addresses", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("10.1.2.3")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.0.8")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
  });

  it("rejects localhost, http, and private IP destinations", async () => {
    await expect(assertPublicHttpsWebhookUrl("http://example.com/hook")).rejects.toThrow(/HTTPS/);
    await expect(assertPublicHttpsWebhookUrl("https://localhost/hook")).rejects.toThrow(
      /localhost or internal/,
    );
    await expect(assertPublicHttpsWebhookUrl("https://127.0.0.1/hook")).rejects.toThrow(
      /private or reserved/,
    );
  });

  it("rejects hostnames that resolve to private addresses", async () => {
    await expect(
      assertPublicHttpsWebhookUrl("https://siem.example/events", async () => [
        { address: "10.0.0.8", family: 4 },
      ]),
    ).rejects.toThrow(/public address/);
  });

  it("accepts HTTPS hostnames that resolve only to public addresses", async () => {
    await expect(
      assertPublicHttpsWebhookUrl("https://siem.example/events", async () => [
        { address: "1.1.1.1", family: 4 },
      ]),
    ).resolves.toBe("https://siem.example/events");
  });
});
