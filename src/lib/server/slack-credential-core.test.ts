import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptSlackWebhook,
  encryptSlackWebhook,
} from "./slack-credential-core";

describe("Slack credential encryption", () => {
  it("round-trips a webhook with AES-256-GCM", () => {
    const key = randomBytes(32).toString("base64");
    const webhook = "https://hooks.slack.com/services/T000/B000/secret";
    const encrypted = encryptSlackWebhook(webhook, key);

    expect(encrypted.ciphertext.toString("utf8")).not.toContain("hooks.slack.com");
    expect(decryptSlackWebhook(encrypted, key)).toBe(webhook);
  });

  it("rejects tampered ciphertext", () => {
    const key = randomBytes(32).toString("base64");
    const encrypted = encryptSlackWebhook(
      "https://hooks.slack.com/services/T000/B000/secret",
      key,
    );
    encrypted.ciphertext[0] ^= 1;

    expect(() => decryptSlackWebhook(encrypted, key)).toThrow();
  });

  it("requires a 32-byte encryption key", () => {
    expect(() =>
      encryptSlackWebhook("https://hooks.slack.com/services/test", "short"),
    ).toThrow("base64-encoded 32-byte key");
  });
});
