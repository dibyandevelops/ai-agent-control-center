import { describe, expect, it } from "vitest";
import { createTotpSecret, decryptMfaSecret, encryptMfaSecret, hashRecoveryCode, totpCode, verifyTotp } from "./mfa-core";

describe("MFA core", () => {
  it("creates and validates a current TOTP code", () => { const secret = createTotpSecret(); const now = 1_700_000_000_000; expect(verifyTotp(secret, totpCode(secret, now), now)).toBe(true); });
  it("encrypts the TOTP secret and hashes recovery codes", () => { const key = Buffer.alloc(32, 7).toString("base64"); const encrypted = encryptMfaSecret("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", key); expect(decryptMfaSecret(encrypted, key)).toBe("ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"); expect(hashRecoveryCode("abcd-1234")).not.toBe("abcd-1234"); });
});
