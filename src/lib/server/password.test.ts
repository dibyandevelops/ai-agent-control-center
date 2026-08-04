import { describe, expect, it } from "vitest";
import {
  generateTemporaryPassword,
  hashPassword,
  verifyPassword,
} from "./password";

describe("operator password hashing", () => {
  it("verifies the correct password and rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(
      verifyPassword("correct horse battery staple", hash),
    ).resolves.toBe(true);
    await expect(verifyPassword("incorrect", hash)).resolves.toBe(false);
  });

  it("uses a unique random salt", async () => {
    const first = await hashPassword("same password");
    const second = await hashPassword("same password");
    expect(first).not.toBe(second);
  });

  it("rejects malformed hashes", async () => {
    await expect(verifyPassword("password", "invalid")).resolves.toBe(false);
  });

  it("generates unique high-entropy temporary passwords", () => {
    const passwords = new Set(
      Array.from({ length: 32 }, () => generateTemporaryPassword()),
    );
    expect(passwords.size).toBe(32);
    for (const password of passwords) {
      expect(password).toMatch(/^sos_tmp_[A-Za-z0-9_-]{32}$/);
    }
  });
});
