import { describe, expect, it } from "vitest";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
} from "./password-reset-core";

describe("password reset core", () => {
  it("generates structured token with prefix and valid sha256 hash", () => {
    const { token, hash } = createPasswordResetToken();
    expect(token).toMatch(/^sop_reset_[A-Za-z0-9_-]{40,}$/);
    expect(hash).toHaveLength(64);
    expect(hashPasswordResetToken(token)).toBe(hash);
  });

  it("produces deterministic hashes for equal tokens", () => {
    const token = "sop_reset_test1234567890abcdefghijklmnopqrstuvwxyz";
    const hash1 = hashPasswordResetToken(token);
    const hash2 = hashPasswordResetToken(token);
    expect(hash1).toBe(hash2);
  });
});
